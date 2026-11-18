import {
  IdParamsSchema,
  RenameProjectRequestSchema,
  type DeleteProjectResponse,
  type RenameProjectResponse,
} from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../../lib/api/errors";
import { getOwnedProject } from "../../../../lib/auth/get-owned-project";
import { createOwnerClient } from "../../../../lib/db/owner";
import { toProject } from "../../../../lib/projects/to-project";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Projet introuvable.";

/**
 * PATCH /api/projects/:id : renomme. `getOwnedProject` d'abord (404 sinon) ; l'écriture passe par le client
 * propriétaire (`authenticated` a `update (name)`), donc la RLS reste active : pas de client de service ici.
 */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  const body: unknown = await request.json().catch(() => null);
  const parsed = RenameProjectRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("validation_error", "Le nom du projet est requis (1 à 100 caractères).");

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    const owner = await createOwnerClient();
    const { data, error } = await owner
      .from("projects")
      .update({ name: parsed.data.name })
      .eq("id", project.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return apiError("not_found", NOT_FOUND);

    return Response.json(toProject(data) satisfies RenameProjectResponse);
  } catch (error) {
    console.error("PATCH /api/projects/:id", error);
    return apiError("internal_error", "Impossible de renommer le projet.");
  }
}

/** DELETE /api/projects/:id : supprime (cascade sur la config, les connaissances et les conversations). */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const parsedId = IdParamsSchema.safeParse(await params);
  if (!parsedId.success) return apiError("not_found", NOT_FOUND);

  try {
    const project = await getOwnedProject(parsedId.data.id);
    if (!project) return apiError("not_found", NOT_FOUND);

    const owner = await createOwnerClient();
    const { error } = await owner.from("projects").delete().eq("id", project.id);
    if (error) throw new Error(error.message);

    return Response.json({ id: project.id } satisfies DeleteProjectResponse);
  } catch (error) {
    console.error("DELETE /api/projects/:id", error);
    return apiError("internal_error", "Impossible de supprimer le projet.");
  }
}
