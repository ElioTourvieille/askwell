import { auth } from "@clerk/nextjs/server";
import { notFound, unstable_rethrow } from "next/navigation";
import { ConversationsManager } from "../../../../../components/conversations";
import { ErrorState } from "../../../../../components/states";
import { getOwnedProject } from "../../../../../lib/auth/get-owned-project";

/**
 * Le serveur ne vérifie que la propriété du projet (404 sinon, client propriétaire, RLS). La liste et les fils
 * sont lus côté navigateur via les routes de P4C-T01, ce qui permet l'actualisation manuelle sans recharger.
 */
export default async function ConversationsPage({ params }: { params: Promise<{ id: string }> }) {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  const { id } = await params;
  try {
    const project = await getOwnedProject(id);
    if (!project) notFound();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Conversations : lecture du projet", error);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <ErrorState text="Impossible de charger le projet. Rechargez la page dans un instant." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <ConversationsManager projectId={id} />
    </div>
  );
}
