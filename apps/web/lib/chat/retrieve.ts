import "server-only";
import { CHAT_RETRIEVAL_CHUNKS } from "@askwell/shared";
import { createServiceClient } from "../db/service";
import { embedTexts } from "../openai";

/** Segment de connaissances renvoyé par `match_chunks`. */
export type RetrievedChunk = {
  id: string;
  sourceId: string;
  content: string;
  /** 1 = identique à la question, 0 = sans rapport (1 - distance cosinus). */
  similarity: number;
};

/** Ce dont la récupération a besoin du client de service (`sql.query` de Neon) ; simulable dans les tests. */
export type ChunkQueryRunner = {
  query(text: string, params: unknown[]): Promise<Record<string, unknown>[]>;
};

export type RetrieveDeps = {
  embed?: (texts: string[]) => Promise<number[][]>;
  db?: ChunkQueryRunner;
};

/** Littéral pgvector : `[0.1,0.2,…]`, converti par `$2::vector` côté SQL. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Cherche les segments les plus proches de la question, pour UN projet (project.md §6.6 étape 4, §9 « Tenant leak »).
 *
 * `match_chunks` impose lui-même le projet et les sources `ready` ; ce fichier ne refiltre rien et n'accepte
 * jamais un identifiant de projet venant du client : l'appelant le tire de la clé publique, côté serveur.
 */
export async function retrieveChunks(
  projectId: string,
  question: string,
  deps: RetrieveDeps = {},
): Promise<RetrievedChunk[]> {
  if (question.trim() === "") return [];

  const embed = deps.embed ?? embedTexts;
  const [vector] = await embed([question]);
  if (!vector) throw new Error("Aucun vecteur n'a été calculé pour la question.");

  const db = deps.db ?? createServiceClient();
  const rows = await db.query("select * from public.match_chunks($1, $2::vector, $3)", [
    projectId,
    toVectorLiteral(vector),
    CHAT_RETRIEVAL_CHUNKS,
  ]);

  return rows.map((row) => ({
    id: String(row.id),
    sourceId: String(row.source_id),
    content: String(row.content),
    similarity: Number(row.similarity),
  }));
}
