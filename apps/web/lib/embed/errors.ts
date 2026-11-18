/** Limite de débit ou quota mensuel atteint (déclenchée plus tard par la route de chat, phase 3). */
export class QuotaReachedError extends Error {
  constructor() {
    super("quota_reached");
    this.name = "QuotaReachedError";
  }
}
