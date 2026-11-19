import type { Tables } from "@askwell/db";
import { KnowledgeSourceSchema, type KnowledgeSource } from "@askwell/shared";

/**
 * Ligne `knowledge_sources` -> `KnowledgeSource` du contrat. N'expose jamais `storage_key` ni `project_id`.
 * Une ligne qui ne respecte pas le contrat (type ou statut inconnu) est écartée plutôt que d'abîmer la page.
 */
export function toKnowledgeSource(row: Tables<"knowledge_sources">): KnowledgeSource | null {
  const created = new Date(row.created_at);
  if (Number.isNaN(created.getTime())) return null;
  const parsed = KnowledgeSourceSchema.safeParse({
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    createdAt: created.toISOString(),
  });
  return parsed.success ? parsed.data : null;
}
