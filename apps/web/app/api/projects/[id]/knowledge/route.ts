import { IdParamsSchema, PasteKnowledgeRequestSchema, type PasteKnowledgeResponse } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../../lib/api/errors";
import { getOwnedProject } from "../../../../../lib/auth/get-owned-project";
import { createServiceClient } from "../../../../../lib/db/service";
import { processSource } from "../../../../../lib/knowledge/process-source";
import {
  claimSource,
  failureMessage,
  isServerFailure,
  loadSource,
  removeSourceRows,
  reserveSource,
  toApiSource,
} from "./shared";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Projet introuvable.";

/** Découpage et représentations OpenAI : plus long qu'une route ordinaire. */
export const maxDuration = 60;

/** POST /api/projects/:id/knowledge : texte collé. Propriété, forfait (serveur), réservation, traitement. */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  const body: unknown = await request.json().catch(() => null);
  const parsed = PasteKnowledgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Un titre (1 à 200 caractères) et un texte (jusqu'à 100 000 caractères) sont requis.");
  }

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    // Client de service : uniquement après la vérification de propriété ci-dessus.
    const sql = createServiceClient();
    const reserved = await reserveSource(sql, project, { title: parsed.data.title, type: "text", storageKey: null });
    if (!reserved.ok) {
      if (reserved.reason === "plan_limit_reached") {
        return apiError(
          "plan_limit_reached",
          "Vous avez atteint le nombre maximum de sources de votre forfait. Supprimez une source ou passez au forfait Pro.",
        );
      }
      return apiError("not_found", reserved.reason === "project_not_found" ? NOT_FOUND : "Compte introuvable.");
    }

    const sourceId = reserved.source.id;
    if (!(await claimSource(sql, project.id, sourceId))) throw new Error("Source réservée mais non revendiquable.");

    const result = await processSource({
      run: (text, values) => sql.query(text, values),
      projectId: project.id,
      sourceId,
      content: { kind: "text", text: parsed.data.content },
    });
    if (!result.ok) {
      // Un texte refusé n'a pas de fichier à examiner : on libère l'emplacement du forfait.
      await removeSourceRows(sql, project.id, sourceId).catch((error: unknown) => {
        console.error("POST /api/projects/:id/knowledge (nettoyage)", error);
      });
      return apiError(isServerFailure(result.reason) ? "internal_error" : "validation_error", failureMessage(result.reason));
    }

    const row = await loadSource(sql, project.id, sourceId);
    if (!row) throw new Error("Source introuvable après traitement.");
    return Response.json(toApiSource(row) satisfies PasteKnowledgeResponse, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/:id/knowledge", error);
    return apiError("internal_error", "Impossible d'ajouter le texte.");
  }
}
