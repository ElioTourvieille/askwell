import { randomUUID } from "node:crypto";
import {
  IdParamsSchema,
  UploadUrlRequestSchema,
  type KnowledgeFileType,
  type UploadUrlResponse,
} from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../../../lib/api/errors";
import { getOwnedProject } from "../../../../../../lib/auth/get-owned-project";
import { createServiceClient } from "../../../../../../lib/db/service";
import { buildObjectKey, createUploadUrl } from "../../../../../../lib/storage";
import { removeSourceRows, reserveSource } from "../shared";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Projet introuvable.";

/** Extensions acceptées par type déclaré (le type seul ne suffit pas : le nom de fichier doit concorder). */
const EXTENSIONS: Record<KnowledgeFileType, readonly string[]> = {
  pdf: ["pdf"],
  md: ["md", "markdown"],
  txt: ["txt"],
};

function hasExpectedExtension(filename: string, type: KnowledgeFileType): boolean {
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined;
  return extension !== undefined && EXTENSIONS[type].includes(extension);
}

/**
 * POST /api/projects/:id/knowledge/upload-url : vérifie propriété, extension et taille DÉCLARÉES, réserve la
 * source (`uploading`, limite du forfait lue sur le serveur) et renvoie une URL présignée de 5 minutes.
 * Les octets réels sont revérifiés par `finalize`.
 */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  const body: unknown = await request.json().catch(() => null);
  const parsed = UploadUrlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Titre, nom de fichier, type (pdf, md, txt) et taille (10 Mo maximum) requis.");
  }
  if (!hasExpectedExtension(parsed.data.filename, parsed.data.type)) {
    return apiError("validation_error", "L'extension du fichier ne correspond pas à son type.");
  }

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    const sql = createServiceClient();
    // Clé décidée par le serveur : jamais le nom de fichier du client.
    const storageKey = buildObjectKey(project.id, randomUUID());
    const reserved = await reserveSource(sql, project, {
      title: parsed.data.title,
      type: parsed.data.type,
      storageKey,
    });
    if (!reserved.ok) {
      if (reserved.reason === "plan_limit_reached") {
        return apiError(
          "plan_limit_reached",
          "Vous avez atteint le nombre maximum de sources de votre forfait. Supprimez une source ou passez au forfait Pro.",
        );
      }
      return apiError("not_found", reserved.reason === "project_not_found" ? NOT_FOUND : "Compte introuvable.");
    }

    try {
      const uploadUrl = await createUploadUrl(storageKey, parsed.data.type);
      return Response.json({ sourceId: reserved.source.id, uploadUrl } satisfies UploadUrlResponse, { status: 201 });
    } catch (error) {
      // Sans URL, la réservation ne servirait à rien : on libère l'emplacement.
      await removeSourceRows(sql, project.id, reserved.source.id).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("POST /api/projects/:id/knowledge/upload-url", error);
    return apiError("internal_error", "Impossible de préparer l'envoi.");
  }
}
