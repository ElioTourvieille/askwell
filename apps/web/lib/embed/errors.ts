/**
 * Erreurs du chat côté panneau. Elles ne portent jamais le texte d'un message (pas de données du visiteur
 * dans les journaux) et le panneau n'affiche jamais leur `message` : il choisit lui-même le texte convivial.
 */

/**
 * Limite atteinte (HTTP 429). `rate_limited` : trop de messages en une minute, le visiteur peut réessayer
 * bientôt. `quota_exceeded` : quota mensuel du projet atteint, inutile de réessayer maintenant.
 */
export class QuotaReachedError extends Error {
  readonly code: "rate_limited" | "quota_exceeded";

  constructor(code: "rate_limited" | "quota_exceeded" = "quota_exceeded") {
    super(code);
    this.name = "QuotaReachedError";
    this.code = code;
  }
}

/** La conversation envoyée n'existe plus pour ce projet (HTTP 404) : il faut repartir d'une nouvelle. */
export class ConversationNotFoundError extends Error {
  constructor() {
    super("conversation_not_found");
    this.name = "ConversationNotFoundError";
  }
}

/** Erreur réessayable : réseau, erreur 5xx, réponse illisible ou refus sans suite particulière. */
export class ChatRequestError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ChatRequestError";
  }
}
