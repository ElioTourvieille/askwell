import type { PosthogConfigResponse } from "@askwell/shared";
import { readPosthogConfig } from "../../../lib/analytics/config";
import { apiError } from "../../../lib/api/errors";

// Lue à chaque requête : la configuration est par environnement, jamais figée au build.
export const dynamic = "force-dynamic";

/** GET /api/posthog-config : clé publique et hôte PostHog (publics par conception, §11). */
export async function GET(): Promise<Response> {
  const config = readPosthogConfig();
  if (!config) return apiError("not_found", "PostHog n'est pas configuré.");
  const body: PosthogConfigResponse = config;
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
