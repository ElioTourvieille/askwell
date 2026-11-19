import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import type { KnowledgeSource } from "@askwell/shared";
import { KnowledgeManager } from "../../../../../components/knowledge";
import { ErrorState } from "../../../../../components/states";
import { loadKnowledgePage } from "../../../../../lib/knowledge-ui/load-knowledge-page";

/**
 * Lecture côté serveur avec le client propriétaire (la RLS fait le tri).
 * Les écritures passent par les routes de A2 ; la liste se met à jour avec leurs réponses.
 */
export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  const { id } = await params;
  let sources: KnowledgeSource[];
  try {
    sources = await loadKnowledgePage(id);
  } catch (error) {
    // Le 404 (projet introuvable) doit atteindre Next ; seule une vraie erreur devient un état d'erreur.
    unstable_rethrow(error);
    console.error("Connaissances : lecture des sources", error);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Connaissances</h1>
        <ErrorState text="Impossible de charger vos sources. Rechargez la page dans un instant." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Connaissances</h1>
      <KnowledgeManager projectId={id} initialSources={sources} />
    </div>
  );
}
