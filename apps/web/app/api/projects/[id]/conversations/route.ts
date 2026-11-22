import { IdParamsSchema, type ListConversationsResponse } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../../lib/api/errors";
import { getOwnedProject } from "../../../../../lib/auth/get-owned-project";
import { parseListQuery } from "../../../../../lib/conversations/list-params";
import { toSummary, type ConversationListRow } from "../../../../../lib/conversations/to-summary";
import { createOwnerClient } from "../../../../../lib/db/owner";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Projet introuvable.";

/**
 * GET /api/projects/:id/conversations : du plus récent au plus ancien, avec aperçu du premier message et nombre
 * de messages. Client propriétaire uniquement (la RLS isole) ; projet d'un autre ou inconnu : 404.
 */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  const query = parseListQuery(request.url);
  if (!query.success) {
    return apiError("validation_error", "`limit` doit être compris entre 1 et 100 et `offset` être positif ou nul.");
  }
  const { limit, offset } = query.data;

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    const owner = await createOwnerClient();
    const { data, error } = await owner
      .from("conversations")
      .select("id, created_at, message_count:messages(count), first_messages:messages(body, created_at)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("created_at", { referencedTable: "first_messages", ascending: true })
      .order("id", { referencedTable: "first_messages", ascending: true })
      .limit(1, { referencedTable: "first_messages" })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Lecture des conversations impossible : ${error.message}`);

    const rows: ConversationListRow[] = data;
    return Response.json({ conversations: rows.map(toSummary) } satisfies ListConversationsResponse);
  } catch (error) {
    console.error("GET /api/projects/:id/conversations", error);
    return apiError("internal_error", "Impossible de lire les conversations.");
  }
}
