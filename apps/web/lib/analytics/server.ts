import "server-only";
import { PostHog } from "posthog-node";
import { readPosthogConfig } from "./config";

let client: PostHog | null = null;
let clientKey: string | null = null;

/**
 * Client PostHog serveur unique. `null` sans configuration : l'appelant ne fait rien.
 * `flushAt: 1` et `flushInterval: 0` : sur Vercel la fonction peut être gelée juste après la réponse,
 * on envoie donc chaque événement tout de suite (les erreurs sont attendues, voir `captureServerException`).
 */
export function getPostHogServer(): PostHog | null {
  const config = readPosthogConfig();
  if (!config) return null;
  if (!client || clientKey !== config.key) {
    client = new PostHog(config.key, { host: config.host, flushAt: 1, flushInterval: 0 });
    clientKey = config.key;
  }
  return client;
}

/** Envoie une erreur serveur à PostHog et attend l'envoi. N'échoue jamais : le suivi ne casse pas une requête. */
export async function captureServerException(
  error: unknown,
  distinctId: string | undefined,
  properties: Record<string, string | number | boolean | undefined> = {},
): Promise<void> {
  const posthog = getPostHogServer();
  if (!posthog) return;
  try {
    // « Immediate » : l'envoi est attendu, la fonction Vercel n'est pas gelée avant la fin. Sans distinctId, PostHog
    // crée un événement sans personne (personless).
    await posthog.captureExceptionImmediate(error, { distinctId, properties });
  } catch {
    // Le suivi ne doit jamais faire échouer la requête.
  }
}
