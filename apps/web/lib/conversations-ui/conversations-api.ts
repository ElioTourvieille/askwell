import {
  ApiErrorSchema,
  ConversationThreadResponseSchema,
  ListConversationsResponseSchema,
  type ConversationSummary,
  type ConversationThreadResponse,
} from "@askwell/shared";

export type FetchLike = typeof fetch;

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau puis réessayez.";
const UNKNOWN_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

async function get<T>(
  fetcher: FetchLike,
  url: string,
  parse: (body: unknown) => T | null,
): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(body);
    return { ok: false, message: error.success ? error.data.error.message : UNKNOWN_ERROR };
  }
  const data = parse(body);
  return data === null ? { ok: false, message: UNKNOWN_ERROR } : { ok: true, data };
}

/** GET /api/projects/:id/conversations (du plus récent au plus ancien). */
export function fetchConversations(fetcher: FetchLike, projectId: string): Promise<Result<ConversationSummary[]>> {
  return get(fetcher, `/api/projects/${projectId}/conversations`, (body) => {
    const parsed = ListConversationsResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.conversations : null;
  });
}

/** GET /api/conversations/:id (fil complet, ordre chronologique). */
export function fetchThread(fetcher: FetchLike, conversationId: string): Promise<Result<ConversationThreadResponse>> {
  return get(fetcher, `/api/conversations/${conversationId}`, (body) => {
    const parsed = ConversationThreadResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  });
}
