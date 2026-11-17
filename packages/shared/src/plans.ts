export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanLimits {
  /** Nombre maximum de projets par compte. */
  maxProjects: number;
  /** Messages de chat par mois et par projet. */
  messagesPerMonth: number;
  /** Sources de connaissances (fichiers + texte collé) par projet. */
  maxKnowledgeSources: number;
  /** Droits de personnalisation du widget. */
  customization: {
    buttonColor: boolean;
    position: boolean;
    label: boolean;
    animation: boolean;
    headerText: boolean;
    hideBadge: boolean;
  };
}

/** Source unique de vérité des forfaits (project.md §5). */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 1,
    messagesPerMonth: 100,
    maxKnowledgeSources: 3,
    customization: {
      buttonColor: false,
      position: false,
      label: false,
      animation: false,
      headerText: false,
      hideBadge: false,
    },
  },
  pro: {
    maxProjects: 5,
    messagesPerMonth: 2000,
    maxKnowledgeSources: 25,
    customization: {
      buttonColor: true,
      position: true,
      label: true,
      animation: true,
      headerText: true,
      hideBadge: true,
    },
  },
};
