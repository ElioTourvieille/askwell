/**
 * Réponse factice (phase 2). UNE seule fonction à remplacer en phase 3 par l'appel à
 * `POST /api/widget/chat` (`ChatRequest` / `ChatResponse` de `@askwell/shared`). Elle peut lever
 * `QuotaReachedError` (limite atteinte) ou une autre erreur (affichée comme erreur réessayable).
 */
export async function fakeReply(message: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const preview = message.length > 60 ? `${message.slice(0, 60)}…` : message;
  return `Ceci est une réponse factice à « ${preview} ». Les vraies réponses arrivent bientôt.`;
}
