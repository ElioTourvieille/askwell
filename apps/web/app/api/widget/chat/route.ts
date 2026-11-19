import { ChatRequestSchema, PLAN_LIMITS, type ChatRequest, type ChatResponse } from "@askwell/shared";
import { apiError } from "../../../../lib/api/errors";
import { answerQuestion } from "../../../../lib/chat/answer";
import { protectChatMessage, type ChatBlockReason } from "../../../../lib/chat/arcjet";
import { retrieveChunks } from "../../../../lib/chat/retrieve";
import { WIDGET_CORS_HEADERS } from "../../../../lib/widget/cors";
import { consumeMessage, conversationBelongsToProject, findProjectByKey, saveChatTurn } from "./store";

// Route publique : AUCUNE session Clerk. Il n'y a plus de middleware sur /api/widget/* (P2P-T11) : ce handler
// n'appelle jamais `auth()`. L'identité est la clé publique, qui n'ouvre aucun droit de propriétaire (§9).

/** Durée maximale de la fonction (secondes) : au-dessus du délai du modèle et du délai de 60 s du panneau. */
export const maxDuration = 60;

/** Délai maximum de récupération + réponse du modèle. Au-delà : 500 (le message est déjà compté). */
const MODEL_TIMEOUT_MS = 45_000;

/** Taille maximale du corps (caractères) : un message de 1 000 caractères ne s'en approche pas. */
const MAX_BODY_CHARS = 16_384;

// CORS ouvert (le widget tourne sur le site du client). On réutilise les en-têtes du widget en les adaptant au
// POST JSON : sans `POST` et `Content-Type`, le pré-vol d'un appel d'une autre origine serait refusé.
const CHAT_CORS_HEADERS = {
  ...WIDGET_CORS_HEADERS,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/** Issue d'un message, pour le suivi : décrit ce qui s'est passé, sans le texte du visiteur. */
type ChatEvent =
  | { kind: "answered"; projectId: string }
  | { kind: "blocked"; reason: ChatBlockReason }
  | { kind: "quota_reached"; projectId: string }
  | { kind: "rejected"; reason: "invalid_request" | "unknown_key" | "unknown_conversation" }
  | { kind: "error"; projectId?: string };

type Outcome = { response: Response; event: ChatEvent };

const done = (response: Response, event: ChatEvent): Outcome => ({ response, event });

/** Lit et valide le corps. `null` si le JSON est illisible, trop gros ou ne respecte pas `ChatRequest`. */
async function readRequest(request: Request): Promise<ChatRequest | null> {
  // `clone()` : le SDK Arcjet reçoit la requête d'origine, encore intacte.
  const raw = await request.clone().text();
  if (raw.length > MAX_BODY_CHARS) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = ChatRequestSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Délai dépassé")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function handleChat(request: Request): Promise<Outcome> {
  // Étape 2 (forme) : on lit la clé et le message, indispensables à la protection. Aucune base ni IA touchée.
  const input = await readRequest(request);
  if (!input) {
    return done(apiError("validation_error", "Requête invalide."), { kind: "rejected", reason: "invalid_request" });
  }

  // Étape 1 : protection Arcjet. Rien n'atteint la base ni l'IA tant que le message n'est pas autorisé.
  let protection;
  try {
    protection = await protectChatMessage({ request, publicKey: input.key, message: input.message });
  } catch (error) {
    // Arcjet inutilisable (clé absente, erreur du SDK) : échec fermé, comme `unavailable`.
    console.error("POST /api/widget/chat : protection indisponible", error);
    protection = { status: "blocked", reason: "unavailable" } as const;
  }
  if (protection.status === "blocked") {
    const event: ChatEvent = { kind: "blocked", reason: protection.reason };
    switch (protection.reason) {
      case "rate_limit":
        return done(apiError("rate_limited", "Trop de messages en peu de temps. Réessayez dans une minute."), event);
      case "injection":
        return done(apiError("injection_blocked", "Ce message ne peut pas être traité."), event);
      case "unavailable":
        // Aucun message compté : rien n'a été consommé avant ce point.
        return done(apiError("internal_error", "Le service est indisponible pour le moment. Réessayez dans un instant."), event);
    }
  }

  // Étape 2 : la clé existe, la conversation (si donnée) est celle de CE projet. Rien n'est compté sinon.
  const project = await findProjectByKey(input.key);
  if (!project) {
    return done(apiError("not_found", "Widget introuvable."), { kind: "rejected", reason: "unknown_key" });
  }
  if (input.conversationId && !(await conversationBelongsToProject(input.conversationId, project.id))) {
    return done(apiError("not_found", "Conversation introuvable."), { kind: "rejected", reason: "unknown_conversation" });
  }

  // Étape 3 : on compte le message AVANT tout appel à OpenAI. Le forfait est lu ici, sur le serveur.
  const allowed = await consumeMessage(project.id, PLAN_LIMITS[project.plan].messagesPerMonth);
  if (!allowed) {
    return done(apiError("quota_exceeded", "Cet assistant a atteint sa limite de messages pour ce mois."), {
      kind: "quota_reached",
      projectId: project.id,
    });
  }

  // Étapes 4 et 5 : récupération puis réponse. Une erreur ou un délai dépassé coûte quand même un message.
  let reply: string;
  try {
    reply = await withTimeout(
      retrieveChunks(project.id, input.message).then((chunks) => answerQuestion(input.message, chunks)),
      MODEL_TIMEOUT_MS,
    );
  } catch (error) {
    console.error("POST /api/widget/chat : réponse impossible", error);
    return done(apiError("internal_error", "L'assistant n'a pas pu répondre. Réessayez dans un instant."), {
      kind: "error",
      projectId: project.id,
    });
  }

  // Étape 6 : enregistrement (crée la conversation au premier message).
  const conversationId = await saveChatTurn({
    projectId: project.id,
    conversationId: input.conversationId ?? null,
    visitorId: input.visitorId,
    visitorBody: input.message,
    botBody: reply,
  });

  return done(Response.json({ conversationId, reply } satisfies ChatResponse), {
    kind: "answered",
    projectId: project.id,
  });
}

/** POST /api/widget/chat : un message du visiteur, une réponse du bot (project.md §6.6). */
export async function POST(request: Request): Promise<Response> {
  let outcome: Outcome;
  try {
    outcome = await handleChat(request);
  } catch (error) {
    // Base indisponible, enregistrement impossible… : jamais de détail, ni le texte du visiteur, dans la réponse.
    console.error("POST /api/widget/chat", error);
    outcome = done(apiError("internal_error", "Une erreur est survenue. Réessayez dans un instant."), { kind: "error" });
  }

  // Point d'appel unique pour le suivi PostHog (phase 4) : `outcome.event` dit ce qui s'est passé (réponse,
  // blocage avec son motif, quota, erreur) et pour quel projet, sans jamais contenir le texte du visiteur.
  for (const [name, value] of Object.entries(CHAT_CORS_HEADERS)) outcome.response.headers.set(name, value);
  return outcome.response;
}

/** Pré-vol CORS (le corps JSON impose `Content-Type`). */
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CHAT_CORS_HEADERS });
}
