import { notFound } from "next/navigation";
import { getOwnedProject } from "../auth/get-owned-project";
import { buildInstallSnippet } from "./buildInstallSnippet";
import { resolveAppUrl } from "./resolveAppUrl";

/**
 * Données de la page d'installation. Projet inexistant, d'un autre propriétaire ou identifiant
 * invalide : même 404, rien n'est révélé. `snippet` vaut `null` si l'adresse de l'application est introuvable (voir `resolveAppUrl`).
 */
export async function loadInstallPage(projectId: string): Promise<{ snippet: string | null }> {
  const project = await getOwnedProject(projectId);
  if (!project) notFound();
  const appUrl = resolveAppUrl({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  });
  return { snippet: buildInstallSnippet(appUrl, project.public_key) };
}
