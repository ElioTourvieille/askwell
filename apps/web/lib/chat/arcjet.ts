import "server-only";
import arcjet, { detectPromptInjection, slidingWindow } from "@arcjet/next";
import { CHAT_RATE_LIMIT_PER_MINUTE } from "@askwell/shared";

/**
 * Protection Arcjet du chat (project.md §6.6 étape 1, §9 « Cost abuse » et « Prompt injection »).
 *
 * - `rate_limit` : plus de 20 messages par minute pour la même clé publique et la même adresse IP.
 * - `injection` : le message ressemble à une injection de prompt.
 * - `unavailable` : Arcjet n'a pas pu décider (erreur). La route envoie du texte au modèle, donc on refuse
 *   plutôt que de laisser passer un texte non vérifié (recommandation du skill arcjet).
 *
 * Un message bloqué ne doit jamais atteindre OpenAI : ce module n'importe rien d'OpenAI.
 */
export type ChatBlockReason = "rate_limit" | "injection" | "unavailable";

export type ChatProtection =
  | { status: "allowed" }
  | { status: "blocked"; reason: ChatBlockReason };

function createClient() {
  const key = process.env.ARCJET_KEY;
  if (!key) {
    // Message sans valeur : jamais la clé dans une erreur ou un journal.
    throw new Error("ARCJET_KEY est absente : la protection du chat ne peut pas être créée (voir project.md §11).");
  }
  return arcjet({
    key,
    // L'adresse IP est lue par le SDK sur la requête ; la clé publique est passée à chaque appel.
    characteristics: ["ip.src", "publicKey"],
    rules: [
      slidingWindow({ mode: "LIVE", interval: "1m", max: CHAT_RATE_LIMIT_PER_MINUTE }),
      detectPromptInjection({ mode: "LIVE" }),
    ],
  });
}

let client: ReturnType<typeof createClient> | undefined;

/** Client Arcjet unique, créé à la demande (jamais à l'import, pour que `next build` n'exige pas la clé). */
function getArcjet() {
  client ??= createClient();
  return client;
}

export type ChatProtectionInput = {
  /** Requête entrante : le SDK en lit l'adresse IP (jamais un en-tête recopié à la main). */
  request: Request;
  /** Clé publique du projet (`pk_…`). */
  publicKey: string;
  /** Texte du visiteur, analysé pour détecter une injection. */
  message: string;
};

/** Décide si un message peut continuer vers la récupération et le modèle. Un seul appel par message. */
export async function protectChatMessage(input: ChatProtectionInput): Promise<ChatProtection> {
  const decision = await getArcjet().protect(input.request, {
    publicKey: input.publicKey,
    detectPromptInjectionMessage: input.message,
  });

  if (decision.isErrored()) return { status: "blocked", reason: "unavailable" };
  if (!decision.isDenied()) return { status: "allowed" };
  if (decision.reason.isRateLimit()) return { status: "blocked", reason: "rate_limit" };
  if (decision.reason.isPromptInjection()) return { status: "blocked", reason: "injection" };
  // Refus d'une autre origine : on refuse aussi (échec fermé).
  return { status: "blocked", reason: "unavailable" };
}
