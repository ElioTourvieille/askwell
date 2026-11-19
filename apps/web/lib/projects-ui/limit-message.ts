import { PLAN_LIMITS } from "@askwell/shared";

/** « Le forfait gratuit permet 1 projet ». La limite vient de `PLAN_LIMITS`, jamais écrite à la main. */
export function freePlanLimitMessage(): string {
  const max = PLAN_LIMITS.free.maxProjects;
  return `Le forfait gratuit permet ${max} projet${max > 1 ? "s" : ""}.`;
}
