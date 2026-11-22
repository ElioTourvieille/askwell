import { WidgetConfigRequestSchema, type WidgetConfigResponse } from "@askwell/shared";
import { apiError } from "../../../../lib/api/errors";
import { protectWidgetIp } from "../../../../lib/chat/arcjet";
import { withWidgetHeaders, WIDGET_CORS_HEADERS } from "../../../../lib/widget/cors";
import { getWidgetConfig } from "../../../../lib/widget/get-widget-config";

/** GET /api/widget/config?key=pk_... : apparence du widget. Publique (aucune session), GET uniquement. */
export async function GET(request: Request): Promise<Response> {
  // Limite par adresse IP seule (B1-T02) : changer de clé ne donne pas de compteur neuf. Si Arcjet ne peut pas
  // décider, on laisse passer : cette route ne lit que l'apparence et n'appelle ni l'IA ni ne compte de message.
  if ((await protectWidgetIp(request)) === "rate_limited") {
    return withWidgetHeaders(apiError("rate_limited", "Trop de requêtes. Réessayez dans une minute."));
  }

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
