import "server-only";
import type { WidgetConfig } from "@askwell/shared";
import { getWidgetConfig } from "../widget/get-widget-config";

/**
 * SEUL endroit qui obtient la configuration du widget pour le panneau.
 *
 * Appel direct de `getWidgetConfig` (même logique que `GET /api/widget/config`, forfait appliqué côté serveur),
 * sans requête HTTP vers soi-même. `null` = clé inconnue ou erreur : la page affiche alors l'écran neutre.
 * Le détail d'une erreur reste dans les journaux serveur, jamais dans la page.
 */
export async function getEmbedConfig(key: string): Promise<WidgetConfig | null> {
  try {
    return await getWidgetConfig(key);
  } catch (error) {
    console.error("getEmbedConfig", error);
    return null;
  }
}
