import { PosthogConfigResponseSchema, type PosthogConfigResponse } from "@askwell/shared";

/**
 * Configuration PostHog lue dans l'environnement à chaque appel (jamais figée au build).
 * Renvoie `null` si la clé ou l'hôte manque ou est invalide : le suivi est alors un no-op.
 */
export function readPosthogConfig(
  env: Record<string, string | undefined> = process.env,
): PosthogConfigResponse | null {
  const parsed = PosthogConfigResponseSchema.safeParse({
    key: env.NEXT_PUBLIC_POSTHOG_KEY,
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return parsed.success ? parsed.data : null;
}
