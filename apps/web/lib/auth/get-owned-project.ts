/**
 * Vérifie qu'un projet appartient au propriétaire connecté.
 *
 * RÈGLE (project.md §9, « Tenant leak ») : une écriture faite avec le client de service
 * (`createServiceClient`) n'est autorisée qu'APRÈS un `getOwnedProject` réussi dans la même route.
 * Ne jamais filtrer à la main par propriétaire avec le client de service.
 *
 * La lecture passe par le client propriétaire : la RLS ne renvoie que ses propres projets.
 * Un projet inexistant, appartenant à un autre ou à l'identifiant invalide donne `null`
 * (la route répond alors 404, sans révéler l'existence du projet).
 */
import { IdParamsSchema } from "@askwell/shared";
import type { Tables } from "@askwell/db";
import { createOwnerClient } from "../db/owner";

export type OwnedProject = Tables<"projects">;

export async function getOwnedProject(projectId: string): Promise<OwnedProject | null> {
  const parsed = IdParamsSchema.safeParse({ id: projectId });
  if (!parsed.success) return null;

  const owner = await createOwnerClient();
  const { data, error } = await owner.from("projects").select("*").eq("id", parsed.data.id).maybeSingle();

  // Une erreur de base n'est pas « pas à moi » : elle remonte (500), elle ne devient pas un 404.
  if (error) throw new Error(`Lecture du projet impossible : ${error.message}`);
  return data;
}
