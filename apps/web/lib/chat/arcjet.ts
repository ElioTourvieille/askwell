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

/**
 * Limite par adresse IP seule (B1-T02), sur toutes les routes publiques `/api/widget/*`.
 *
 * La limite du chat compte par IP + clé publique : changer de `pk_…` à chaque requête donne un compteur neuf,
 * donc une lecture de base (`findProjectByKey`) avant le 404. Ce compteur-ci ignore la clé : 60 requêtes par
 * minute et par IP, quelle que soit la clé. Plus large que la limite par clé (20) pour ne pas gêner un site
 * derrière une adresse partagée. Valeur locale : `packages/shared` ne change pas.
 */
export const WIDGET_IP_RATE_LIMIT_PER_MINUTE = 60;

export type WidgetIpProtection = "allowed" | "rate_limited" | "unavailable";

function createIpClient() {
  const key = process.env.ARCJET_KEY;
  if (!key) {
    throw new Error("ARCJET_KEY est absente : la limite par adresse IP ne peut pas être créée (voir project.md §11).");
  }
  return arcjet({
    key,
    characteristics: ["ip.src"],
    rules: [slidingWindow({ mode: "LIVE", interval: "1m", max: WIDGET_IP_RATE_LIMIT_PER_MINUTE })],
  });
}

let ipClient: ReturnType<typeof createIpClient> | undefined;

function getIpArcjet() {
  ipClient ??= createIpClient();
  return ipClient;
}

/**
 * Compte la requête pour son adresse IP, avant toute lecture de base. L'appelant choisit quoi faire quand
 * `unavailable` (le chat échoue fermé ; la configuration du widget laisse passer).
 */
export async function protectWidgetIp(request: Request): Promise<WidgetIpProtection> {
  let decision;
  try {
    decision = await getIpArcjet().protect(request);
  } catch (error) {
    console.error("Limite par adresse IP indisponible", error);
    return "unavailable";
  }
  if (decision.isErrored()) return "unavailable";
  if (!decision.isDenied()) return "allowed";
  return decision.reason.isRateLimit() ? "rate_limited" : "unavailable";
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
