import { PLAN_LIMITS, type Plan } from "@askwell/shared";

export type Usage = {
  /** Messages comptés pour le mois courant (0 si la période stockée est périmée). */
  used: number;
  limit: number;
  /** 0 à 100, arrondi. */
  percent: number;
  reached: boolean;
  /** Début du mois suivant (ISO, UTC) : date de la prochaine remise à zéro. */
  nextResetAt: string;
};

function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Utilisation mensuelle d'un projet. La limite vient de `PLAN_LIMITS[plan]` ; le forfait est lu sur le serveur.
 *
 * La remise à zéro est PARESSEUSE (`consume_message`, project.md §6.12) : la base ne remet `messages_used` à 0
 * qu'au prochain message accepté. Si `period_start` est antérieur au début du mois courant, le compteur stocké
 * est périmé : le mois en cours compte 0. Le début de mois est calculé en UTC, comme `date_trunc('month', now())`
 * sur Neon (fuseau UTC).
 */
export function computeUsage(input: { messagesUsed: number; periodStart: string; plan: Plan; now?: Date }): Usage {
  const now = input.now ?? new Date();
  const monthStart = monthStartUtc(now);
  const periodStart = new Date(input.periodStart);
  const stale = Number.isNaN(periodStart.getTime()) || periodStart < monthStart;

  const limit = PLAN_LIMITS[input.plan].messagesPerMonth;
  const used = stale ? 0 : Math.max(0, input.messagesUsed);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return {
    used,
    limit,
    percent,
    reached: used >= limit,
    nextResetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
}
