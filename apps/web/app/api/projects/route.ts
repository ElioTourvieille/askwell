import { CreateProjectRequestSchema, type CreateProjectResponse, type ListProjectsResponse } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { apiError } from "../../../lib/api/errors";
import { createOwnerClient } from "../../../lib/db/owner";
import { createProject } from "../../../lib/projects/create-project";
import { toProject } from "../../../lib/projects/to-project";

/** GET /api/projects : projets du propriétaire (la RLS fait le tri). */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  try {
    const owner = await createOwnerClient();
    const { data, error } = await owner.from("projects").select("*").order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return Response.json({ projects: data.map(toProject) } satisfies ListProjectsResponse);
  } catch (error) {
    console.error("GET /api/projects", error);
    return apiError("internal_error", "Impossible de lister les projets.");
  }
}

/** POST /api/projects : crée un projet, limite du forfait vérifiée sur le serveur. */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Connexion requise.");

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateProjectRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("validation_error", "Le nom du projet est requis (1 à 100 caractères).");

  try {
    const result = await createProject(userId, parsed.data.name);
    if (!result.ok) {
      if (result.reason === "plan_limit_reached") {
        return apiError(
          "plan_limit_reached",
          "Vous avez atteint le nombre maximum de projets de votre forfait. Passez au forfait Pro pour en créer d'autres.",
        );
      }
      return apiError("not_found", "Compte introuvable. Rechargez le tableau de bord puis réessayez.");
    }
    return Response.json(toProject(result.project) satisfies CreateProjectResponse, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects", error);
    return apiError("internal_error", "Impossible de créer le projet.");
  }
}
