import { WidgetConfigRequestSchema, type WidgetConfigResponse } from "@askwell/shared";
import { apiError } from "../../../../lib/api/errors";
import { withWidgetHeaders, WIDGET_CORS_HEADERS } from "../../../../lib/widget/cors";
import { getWidgetConfig } from "../../../../lib/widget/get-widget-config";

// TODO(phase 3) : limite de débit (Arcjet) sur cette route publique. Décision du Product Owner : pas avant la phase 3.

/** GET /api/widget/config?key=pk_... : apparence du widget. Publique (aucune session), GET uniquement. */
export async function GET(request: Request): Promise<Response> {
  const parsed = WidgetConfigRequestSchema.safeParse({ key: new URL(request.url).searchParams.get("key") });
  // Clé absente, mal formée ou inconnue : même 404, sans rien révéler (le chargeur n'affiche alors rien).
  if (!parsed.success) return withWidgetHeaders(apiError("not_found", "Widget introuvable."));

  try {
    const config = await getWidgetConfig(parsed.data.key);
    if (!config) return withWidgetHeaders(apiError("not_found", "Widget introuvable."));
    return withWidgetHeaders(Response.json(config satisfies WidgetConfigResponse));
  } catch (error) {
    console.error("GET /api/widget/config", error);
    return withWidgetHeaders(apiError("internal_error", "Configuration indisponible."));
  }
}

/** Pré-vol CORS. */
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}
