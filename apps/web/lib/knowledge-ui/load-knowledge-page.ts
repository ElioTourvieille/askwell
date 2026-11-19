import { notFound } from "next/navigation";
import type { KnowledgeSource } from "@askwell/shared";
import { getOwnedProject } from "../auth/get-owned-project";
import { createOwnerClient } from "../db/owner";
import { toKnowledgeSource } from "./to-source";

/**
 * Données de la page « Connaissances ». Lecture avec le CLIENT PROPRIÉTAIRE (la RLS fait le tri),
 * jamais le client de service. Projet inexistant, d'un autre propriétaire ou identifiant invalide :
 * même 404, rien n'est révélé. Une erreur de base remonte (la page affiche un état d'erreur).
 */
export async function loadKnowledgePage(projectId: string): Promise<KnowledgeSource[]> {
  const project = await getOwnedProject(projectId);
  if (!project) notFound();

  const owner = await createOwnerClient();
  const { data, error } = await owner
    .from("knowledge_sources")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Lecture des sources impossible : ${error.message}`);

  return data.flatMap((row) => {
    const source = toKnowledgeSource(row);
    return source ? [source] : [];
  });
}
