import "server-only";
import {
  applyPlanToConfig,
  PLANS,
  WidgetConfigSchema,
  type Plan,
  type WidgetConfig,
} from "@askwell/shared";
import { createServiceClient } from "../db/service";

function isPlan(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

/**
 * Configuration publique d'un widget à partir de sa clé publique (route visiteur : le client de service est
 * l'outil prévu, la clé publique est le seul point d'entrée).
 *
 * Le forfait du propriétaire est lu ici, sur le serveur, puis appliqué avec `applyPlanToConfig` (project.md §5,
 * §9 « Plan bypass »). Renvoie `null` si la clé ne correspond à aucun projet. Ne renvoie QUE les 6 champs de
 * configuration : jamais le forfait, l'identifiant du projet ni celui du propriétaire.
 */
export async function getWidgetConfig(publicKey: string): Promise<WidgetConfig | null> {
  const sql = createServiceClient();
  const rows = await sql.query(
    `select w.button_color, w.position, w.label, w.animation, w.header_text, w.show_badge, a.plan
       from public.projects p
       join public.widget_configs w on w.project_id = p.id
       join public.accounts a on a.clerk_user_id = p.owner_id
      where p.public_key = $1`,
    [publicKey],
  );

  const row = rows[0];
  if (!row) return null;
  if (!isPlan(row.plan)) throw new Error("Forfait inconnu dans la table accounts.");

  // `parse` retire tout champ en trop et refuse une configuration invalide en base.
  const config = WidgetConfigSchema.parse({
    button_color: row.button_color,
    position: row.position,
    label: row.label,
    animation: row.animation,
    header_text: row.header_text,
    show_badge: row.show_badge,
  });
  return applyPlanToConfig(row.plan, config);
}
