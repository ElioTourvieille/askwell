import { PLAN_LIMITS, type Plan, type PlanLimits } from "@askwell/shared";

export type PlanRow = { label: string; free: string; pro: string };

const nf = new Intl.NumberFormat("fr-FR");

/** Textes affichés pour chaque droit de personnalisation (free = refusé, pro = accordé). */
const CUSTOMIZATION_ROWS: Array<{
  label: string;
  key: keyof PlanLimits["customization"];
  off: string;
  on: string;
}> = [
  { label: "Couleur du bouton", key: "buttonColor", off: "Par défaut", on: "Au choix" },
  { label: "Position du bouton", key: "position", off: "En bas à droite", on: "N'importe quel coin" },
  { label: "Libellé du bouton", key: "label", off: "Par défaut", on: "Personnalisé" },
  {
    label: "Animation d'ouverture",
    key: "animation",
    off: "Fondu",
    on: "Fondu, glissement ou mise à l'échelle",
  },
  { label: "Texte de l'en-tête", key: "headerText", off: "Par défaut", on: "Personnalisé" },
];

function customization(limits: Record<Plan, PlanLimits>, plan: Plan, row: (typeof CUSTOMIZATION_ROWS)[number]) {
  return limits[plan].customization[row.key] ? row.on : row.off;
}

/** Lignes du tableau des forfaits (project.md §5), toutes dérivées de PLAN_LIMITS. */
export function buildPlanRows(limits: Record<Plan, PlanLimits> = PLAN_LIMITS): PlanRow[] {
  return [
    { label: "Projets", free: nf.format(limits.free.maxProjects), pro: nf.format(limits.pro.maxProjects) },
    {
      label: "Messages par mois (par projet)",
      free: nf.format(limits.free.messagesPerMonth),
      pro: nf.format(limits.pro.messagesPerMonth),
    },
    {
      label: "Sources de connaissances (par projet)",
      free: nf.format(limits.free.maxKnowledgeSources),
      pro: nf.format(limits.pro.maxKnowledgeSources),
    },
    ...CUSTOMIZATION_ROWS.map((row) => ({
      label: row.label,
      free: customization(limits, "free", row),
      pro: customization(limits, "pro", row),
    })),
    {
      label: "Badge « Powered by »",
      free: limits.free.customization.hideBadge ? "Masqué" : "Affiché",
      pro: limits.pro.customization.hideBadge ? "Masqué" : "Affiché",
    },
  ];
}
