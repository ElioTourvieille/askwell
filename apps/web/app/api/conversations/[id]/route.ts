import { IdParamsSchema, type ConversationThreadResponse } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../lib/api/errors";
import { toMessage } from "../../../../lib/conversations/to-summary";
import { createOwnerClient } from "../../../../lib/db/owner";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Conversation introuvable.";

/**
 * GET /api/conversations/:id : le fil complet, dans l'ordre chronologique. La propriété est établie par la RLS
 * (client propriétaire) : la conversation d'un autre propriétaire est invisible, donc 404 (jamais 403).
 */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  try {
    const owner = await createOwnerClient();
    const { data: conversation, error } = await owner
      .from("conversations")
      .select("id, created_at")
      .eq("id", parsedId.data.id)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la conversation impossible : ${error.message}`);
    if (!conversation) return apiError("not_found", NOT_FOUND);

    const { data: rows, error: messagesError } = await owner
      .from("messages")
      .select("id, role, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (messagesError) throw new Error(`Lecture des messages impossible : ${messagesError.message}`);

    const messages = rows.flatMap((row) => toMessage(row) ?? []);
    return Response.json({
      id: conversation.id,
      createdAt: new Date(conversation.created_at).toISOString(),
      messages,
    } satisfies ConversationThreadResponse);
  } catch (error) {
    console.error("GET /api/conversations/:id", error);
    return apiError("internal_error", "Impossible de lire la conversation.");
  }
}
