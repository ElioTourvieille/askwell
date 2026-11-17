/** Protocole iframe → chargeur (B1 l'implémente en face). */
export type ParentMessage =
  | { source: "askwell"; type: "close" }
  | { source: "askwell"; type: "resize"; height: number }
  | { source: "askwell"; type: "unread"; count: number };

/**
 * Valide le paramètre `origin` : URL bien formée, protocole http/https. Renvoie l'ORIGINE normalisée
 * (utilisable comme `targetOrigin`) ou null. Jamais de joker comme origine cible.
 */
export function parseParentOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Envoie un message au chargeur ; sans origine valide, n'envoie rien. */
export function postToParent(
  targetOrigin: string | null,
  message: ParentMessage,
  parent: Pick<Window, "postMessage"> = window.parent,
): void {
  if (!targetOrigin) return;
  parent.postMessage(message, targetOrigin);
}
