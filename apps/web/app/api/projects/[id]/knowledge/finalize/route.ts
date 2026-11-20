import {
  FinalizeKnowledgeRequestSchema,
  IdParamsSchema,
  MAX_KNOWLEDGE_FILE_BYTES,
  KNOWLEDGE_FILE_TYPES,
  type FinalizeKnowledgeResponse,
  type KnowledgeFileType,
} from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../../../lib/api/errors";
import { getOwnedProject } from "../../../../../../lib/auth/get-owned-project";
import { createServiceClient, type ServiceClient } from "../../../../../../lib/db/service";
import { processSource } from "../../../../../../lib/knowledge/process-source";
import { deleteObject, ObjectTooLargeError, readObject } from "../../../../../../lib/storage";
import {
  STALE_UPLOAD_HOURS,
  claimSource,
  failureMessage,
  isServerFailure,
  loadSource,
  toApiSource,
} from "../shared";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Projet introuvable.";

/** Lecture du fichier, extraction et représentations OpenAI : plus long qu'une route ordinaire. */
export const maxDuration = 60;

function isFileType(value: string): value is KnowledgeFileType {
  return KNOWLEDGE_FILE_TYPES.some((type) => type === value);
}

/** Source revendiquée dont le fichier est inutilisable : objet supprimé, clé effacée, source `failed`. */
async function failClaimed(sql: ServiceClient, projectId: string, sourceId: string, storageKey: string): Promise<void> {
  let deleted = false;
  try {
    await deleteObject(storageKey);
    deleted = true;
  } catch {
    // L'objet reste (privé) : la suppression de la source le retirera.
  }
  await sql.query(
    `update public.knowledge_sources set status = 'failed'${deleted ? ", storage_key = null" : ""}
     where id = $1 and project_id = $2`,
    [sourceId, projectId],
  );
}

/**
 * POST /api/projects/:id/knowledge/finalize : revendique la source UNE fois (`uploading` -> `processing`),
 * refuse une source de plus de 2 h, lit le fichier UNE fois, puis vérifie et traite ces mêmes octets.
 */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  const body: unknown = await request.json().catch(() => null);
  const parsed = FinalizeKnowledgeRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("validation_error", "Identifiant de source invalide.");

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    const sql = createServiceClient();
    const sourceId = parsed.data.sourceId;

    // Filtre par projet DÉJÀ vérifié : une source d'un autre projet donne 404.
    const existing = await loadSource(sql, project.id, sourceId);
    if (!existing || !existing.storage_key || !isFileType(existing.type)) {
      return apiError("not_found", "Source introuvable.");
    }

    const claimed = await claimSource(sql, project.id, sourceId, STALE_UPLOAD_HOURS);
    if (!claimed) {
      return apiError(
        "validation_error",
        existing.status === "uploading"
          ? "Cet envoi a expiré (plus de 2 heures). Supprimez la source et recommencez."
          : "Cette source a déjà été traitée.",
      );
    }
    const storageKey = existing.storage_key;
    const type = existing.type;

    let bytes: Uint8Array;
    try {
      bytes = await readObject(storageKey, MAX_KNOWLEDGE_FILE_BYTES);
    } catch (error) {
      await failClaimed(sql, project.id, sourceId, storageKey);
      if (error instanceof ObjectTooLargeError) return apiError("validation_error", failureMessage("too_large"));
      console.error("POST /api/projects/:id/knowledge/finalize (lecture)", error);
      return apiError("validation_error", "Le fichier n'a pas été reçu. Recommencez l'envoi.");
    }

    // Taille réelle et octets PDF vérifiés par `processSource` sur ces mêmes octets (un seul GET).
    const result = await processSource({
      run: (text, values) => sql.query(text, values),
      projectId: project.id,
      sourceId,
      content: { kind: "file", type, bytes, storageKey },
      deleteObject,
    });
    if (!result.ok) {
      return apiError(isServerFailure(result.reason) ? "internal_error" : "validation_error", failureMessage(result.reason));
    }

    const row = await loadSource(sql, project.id, sourceId);
    if (!row) throw new Error("Source introuvable après traitement.");
    return Response.json(toApiSource(row) satisfies FinalizeKnowledgeResponse);
  } catch (error) {
    console.error("POST /api/projects/:id/knowledge/finalize", error);
    return apiError("internal_error", "Impossible de traiter le fichier.");
  }
}
