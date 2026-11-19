import { auth } from "@clerk/nextjs/server";
import { ErrorState } from "../../components/states";
import { ProjectsManager } from "../../components/projects";
import { createOwnerClient } from "../../lib/db/owner";
import { toProject } from "../../lib/projects/to-project";

/**
 * Lecture côté serveur avec le client propriétaire (même requête que GET /api/projects : la RLS fait le tri).
 * Un seul chemin de lecture : pas d'aller-retour réseau de plus, la liste est dans le HTML initial.
 * Les écritures (créer, renommer, supprimer) passent par les routes de A1.
 */
export default async function DashboardPage() {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  let projects;
  try {
    const owner = await createOwnerClient();
    const { data, error } = await owner.from("projects").select("*").order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    projects = data.map(toProject);
  } catch (error) {
    console.error("Dashboard : lecture des projets", error);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Projets</h1>
        <ErrorState text="Impossible de charger vos projets. Rechargez la page dans un instant." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Projets</h1>
      <ProjectsManager initialProjects={projects} />
    </div>
  );
}
