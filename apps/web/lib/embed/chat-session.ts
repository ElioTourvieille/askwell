import { postChat, type FetchLike } from "./chat-client";
import { ConversationNotFoundError, MessageRejectedError, QuotaReachedError } from "./errors";

/** Ce que le panneau doit afficher après l'envoi d'un message. */
export type ChatOutcome =
  | { kind: "reply"; text: string }
  /** 429. `permanent` : quota mensuel atteint (le panneau se bloque) ; sinon limite par minute (on peut réessayer). */
  | { kind: "limited"; permanent: boolean }
  /** 400 `injection_blocked` : message neutre, pas de « Réessayer » (le visiteur reformule). */
  | { kind: "rejected" }
  /** Réseau, délai dépassé, 5xx, réponse illisible ou autre refus : erreur réessayable. */
  | { kind: "error" };

export type ChatSessionOptions = {
  /** Clé publique du projet (`pk_…`), lue dans l'URL de l'iframe. */
  key: string;
  /** Identifiant du visiteur, lu à chaque envoi (localStorage protégé, repli en mémoire). */
  getVisitorId: () => string;
  fetchImpl?: FetchLike;
};

export type ChatSession = {
  /** Envoie un message ; ne lève jamais : le résultat dit quoi afficher. */
  send(message: string): Promise<ChatOutcome>;
  /** Conversation en cours (en mémoire de l'iframe seulement), `undefined` avant la première réponse. */
  readonly conversationId: string | undefined;
};

/**
 * Conversation du visiteur dans l'iframe : garde le `conversationId` renvoyé par la première réponse et le
 * joint aux messages suivants. Si la route répond 404 pour cette conversation, on repart d'une nouvelle
 * (un seul essai, pour ne jamais boucler).
 */
export function createChatSession(options: ChatSessionOptions): ChatSession {
  let conversationId: string | undefined;

  const attempt = (message: string) =>
    postChat(
      { key: options.key, visitorId: options.getVisitorId(), message, conversationId },
      options.fetchImpl,
    );

  return {
    get conversationId() {
      return conversationId;
    },

    async send(message) {
      try {
        let response;
        try {
          response = await attempt(message);
        } catch (error) {
          if (!(error instanceof ConversationNotFoundError) || conversationId === undefined) throw error;
          conversationId = undefined;
          response = await attempt(message);
        }
        conversationId = response.conversationId;
        return { kind: "reply", text: response.reply };
      } catch (error) {
        if (error instanceof QuotaReachedError) {
          return { kind: "limited", permanent: error.code === "quota_exceeded" };
        }
        if (error instanceof MessageRejectedError) return { kind: "rejected" };
        return { kind: "error" };
      }
    },
  };
}

/**
 * État du panneau. `quota` bloque la saisie ; `limited` affiche le même message mais laisse réessayer ;
 * `rejected` affiche un message neutre, sans « Réessayer », la saisie reste active.
 */
export type PanelStatus = "idle" | "typing" | "error" | "quota" | "limited" | "rejected";

/** État du panneau après un envoi terminé. */
export function statusAfter(outcome: ChatOutcome): PanelStatus {
  if (outcome.kind === "reply") return "idle";
  if (outcome.kind === "limited") return outcome.permanent ? "quota" : "limited";
  if (outcome.kind === "rejected") return "rejected";
  return "error";
}
