import {
  ApiErrorSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from "@askwell/shared";
import { ChatRequestError, ConversationNotFoundError, QuotaReachedError } from "./errors";

/** Route publique du chat (project.md §6.6). Même origine que le panneau : l'iframe est servie par l'application. */
export const CHAT_ENDPOINT = "/api/widget/chat";

/** Ce dont on a besoin de `fetch` ; remplaçable dans les tests. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Envoie un message à `POST /api/widget/chat`.
 *
 * Lève :
 * - `QuotaReachedError` pour un 429 (`rate_limited` ou `quota_exceeded`) ;
 * - `ConversationNotFoundError` pour un 404 ;
 * - `ChatRequestError` (réessayable) pour le réseau, un 5xx, une réponse illisible ou tout autre refus.
 *
 * Les types viennent de `@askwell/shared` : la requête est validée avant l'envoi, la réponse après.
 */
export async function postChat(request: ChatRequest, fetchImpl: FetchLike = defaultFetch): Promise<ChatResponse> {
  const parsed = ChatRequestSchema.safeParse(request);
  if (!parsed.success) throw new ChatRequestError("invalid_request");

  let response: Response;
  try {
    response = await fetchImpl(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      // Route publique : aucun cookie n'est utile, aucun n'est envoyé.
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new ChatRequestError("network");
  }

  const body: unknown = await response.json().catch(() => null);

  if (response.ok) {
    const reply = ChatResponseSchema.safeParse(body);
    if (!reply.success) throw new ChatRequestError("invalid_response");
    return reply.data;
  }

  const code = ApiErrorSchema.safeParse(body).data?.error.code;
  if (response.status === 429) {
    throw new QuotaReachedError(code === "quota_exceeded" ? "quota_exceeded" : "rate_limited");
  }
  if (response.status === 404) throw new ConversationNotFoundError();
  throw new ChatRequestError(`http_${response.status}`);
}
