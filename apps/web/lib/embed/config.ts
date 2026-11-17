import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@askwell/shared";

/**
 * SEUL endroit qui obtient la configuration du widget pour le panneau.
 *
 * TODO(A2 — route /api/widget/config fusionnée) : remplacer le `return DEFAULT_WIDGET_CONFIG` ci-dessous par
 * l'appel réel, sur la même origine :
 *
 *   const res = await fetch(`${baseUrl}/api/widget/config?key=${encodeURIComponent(key)}`, { cache: "no-store" });
 *   if (!res.ok) return null;
 *   return WidgetConfigResponseSchema.parse(await res.json());
 *
 * `null` = clé inconnue ou erreur : la page affiche alors l'écran neutre.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `key` sera utilisé par l'appel réel (voir TODO)
export async function getEmbedConfig(key: string): Promise<WidgetConfig | null> {
  return DEFAULT_WIDGET_CONFIG;
}
