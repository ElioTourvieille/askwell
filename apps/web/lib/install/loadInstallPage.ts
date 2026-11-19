import { notFound } from "next/navigation";
import { getOwnedProject } from "../auth/get-owned-project";
import { buildInstallSnippet } from "./buildInstallSnippet";

/**
 * Données de la page d'installation. Projet inexistant, d'un autre propriétaire ou identifiant
 * invalide : même 404, rien n'est révélé. `snippet` vaut `null` si `NEXT_PUBLIC_APP_URL` est absente.
 */
export async function loadInstallPage(projectId: string): Promise<{ snippet: string | null }> {
  const project = await getOwnedProject(projectId);
  if (!project) notFound();
  return { snippet: buildInstallSnippet(process.env.NEXT_PUBLIC_APP_URL, project.public_key) };
}
