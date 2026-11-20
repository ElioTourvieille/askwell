import { IdParamsSchema, type DeleteKnowledgeResponse } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../lib/api/errors";
import { createOwnerClient } from "../../../../lib/db/owner";
import { createServiceClient } from "../../../../lib/db/service";
import { deleteObject } from "../../../../lib/storage";
import { removeSourceRows } from "../../projects/[id]/knowledge/shared";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Source introuvable.";

/**
 * DELETE /api/knowledge/:id : supprime fichier, segments et source, quel que soit le statut (`uploading` et
 * `failed` compris : c'est ainsi qu'on libère l'emplacement d'un envoi interrompu).
 * La propriété est établie par une lecture avec le client propriétaire (la RLS ne renvoie que ses sources).
 */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  try {
    const owner = await createOwnerClient();
    const { data: source, error } = await owner
      .from("knowledge_sources")
      .select("id, project_id, storage_key")
      .eq("id", parsedId.data.id)
      .maybeSingle();
    if (error) throw new Error(`Lecture de la source impossible : ${error.message}`);
    if (!source) return apiError("not_found", NOT_FOUND);

    // Propriété vérifiée ci-dessus : le client de service peut écrire.
    // Fichier d'abord : si sa suppression échoue, la source reste et l'appel peut être répété.
    if (source.storage_key) await deleteObject(source.storage_key);
    await removeSourceRows(createServiceClient(), source.project_id, source.id);

    return Response.json({ id: source.id } satisfies DeleteKnowledgeResponse);
  } catch (error) {
    console.error("DELETE /api/knowledge/:id", error);
    return apiError("internal_error", "Impossible de supprimer la source.");
  }
}
