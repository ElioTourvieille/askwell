import type { KnowledgeFileType } from "@askwell/shared";
import { embedTexts } from "../openai";
import { chunkText } from "./chunk-text";
import { INSERT_BATCH_SIZE, MAX_CHUNKS_PER_SOURCE } from "./constants";
import { ExtractionError, extractText, verifyFile, type RefusalReason } from "./extract-text";

/**
 * Exécute une requête SQL paramétrée avec le client de service. En production :
 * `const sql = createServiceClient(); const run = (text, params) => sql.query(text, params);`
 */
export type SqlRun = (text: string, params: unknown[]) => Promise<unknown>;

export type SourceContent =
  | { kind: "text"; text: string }
  | { kind: "file"; type: KnowledgeFileType; bytes: Uint8Array; storageKey: string };

export type ProcessSourceInput = {
  run: SqlRun;
  /** Identifiants DÉJÀ vérifiés par la route (`getOwnedProject`) : cette fonction ne contrôle pas la propriété. */
  projectId: string;
  sourceId: string;
  content: SourceContent;
  /** Obligatoire pour un fichier : supprime l'objet d'un fichier refusé. */
  deleteObject?: (key: string) => Promise<void>;
  /** Représentations (embeddings) ; par défaut `embedTexts` de `lib/openai.ts`. */
  embed?: (texts: string[]) => Promise<number[][]>;
};

export type FailureReason = RefusalReason | "unreadable" | "no_text" | "too_much_text" | "embedding_failed" | "insert_failed" | "not_processing";

export type ProcessResult =
  | { ok: true; chunks: number }
  | { ok: false; reason: FailureReason; fileDeleted: boolean };

/** Les lignes d'un résultat, qu'il vienne de `sql.query` (Neon : tableau) ou d'un client à `{ rows }`. */
function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/** Réponse du modèle -> littéral pgvector `[1,2,3]`. Refuse tout ce qui n'est pas un nombre fini. */
function toVectorLiteral(vector: number[]): string {
  if (vector.some((value) => !Number.isFinite(value))) throw new Error("Vecteur invalide.");
  return `[${vector.join(",")}]`;
}

async function insertChunks(
  run: SqlRun,
  projectId: string,
  sourceId: string,
  chunks: string[],
  vectors: number[][],
): Promise<void> {
  for (let start = 0; start < chunks.length; start += INSERT_BATCH_SIZE) {
    const batch = chunks.slice(start, start + INSERT_BATCH_SIZE);
    const params: unknown[] = [projectId, sourceId];
    const rows = batch.map((content, i) => {
      const vector = vectors[start + i];
      if (!vector) throw new Error("Vecteur manquant.");
      params.push(content, toVectorLiteral(vector));
      const base = params.length - 2;
      return `($1, $2, $${base + 1}, $${base + 2}::public.vector)`;
    });
    await run(
      `insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ${rows.join(", ")}`,
      params,
    );
  }
}

/** Passe la source de `processing` à `failed`. Si le fichier est supprimé, la clé d'objet est effacée. */
async function markFailed(run: SqlRun, input: ProcessSourceInput, deleteFile: boolean): Promise<boolean> {
  let fileDeleted = false;
  if (deleteFile && input.content.kind === "file" && input.deleteObject) {
    try {
      await input.deleteObject(input.content.storageKey);
      fileDeleted = true;
    } catch {
      // L'objet reste (privé) : la suppression de la source le retirera. On ne masque pas l'échec principal.
    }
  }
  await run(
    `update public.knowledge_sources set status = 'failed'${fileDeleted ? ", storage_key = null" : ""}
     where id = $1 and project_id = $2`,
    [input.sourceId, input.projectId],
  );
  return fileDeleted;
}

/**
 * Traite une source : vérifier (fichier) → extraire → découper → représentations OpenAI → insérer dans
 * `knowledge_chunks` → source `ready`. Un fichier refusé (faux PDF, trop gros, vide…) passe la source en
 * `failed` ET supprime l'objet. Ne contrôle pas la propriété : `projectId` et `sourceId` viennent d'une
 * route qui a déjà vérifié le propriétaire. Ne modifie qu'une source en `processing` (revendiquée une seule
 * fois par `finalize`), et nettoie ses segments si un lot échoue.
 */
export async function processSource(input: ProcessSourceInput): Promise<ProcessResult> {
  const { run, projectId, sourceId, content } = input;
  const embed = input.embed ?? embedTexts;
  const fail = async (reason: FailureReason, deleteFile = false): Promise<ProcessResult> => ({
    ok: false,
    reason,
    fileDeleted: await markFailed(run, input, deleteFile),
  });

  let text: string;
  if (content.kind === "file") {
    const verification = verifyFile(content.type, content.bytes);
    if (!verification.ok) return fail(verification.reason, true);
    try {
      text = await extractText(content.type, content.bytes);
    } catch (error) {
      if (error instanceof ExtractionError) return fail("unreadable", true);
      throw error;
    }
  } else {
    text = content.text;
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) return fail("no_text", content.kind === "file");
  // Avant tout appel à `embed` : un texte démesuré ne doit coûter ni appels OpenAI ni stockage.
  if (chunks.length > MAX_CHUNKS_PER_SOURCE) return fail("too_much_text", content.kind === "file");

  let vectors: number[][];
  try {
    vectors = await embed(chunks);
    if (vectors.length !== chunks.length) throw new Error("Nombre de vecteurs inattendu.");
  } catch {
    return fail("embedding_failed");
  }

  try {
    await insertChunks(run, projectId, sourceId, chunks, vectors);
    const done = rowsOf(
      await run(
        `update public.knowledge_sources set status = 'ready'
         where id = $1 and project_id = $2 and status = 'processing' returning id`,
        [sourceId, projectId],
      ),
    );
    if (done.length !== 1) {
      // Source supprimée ou déjà traitée pendant ce temps : on ne laisse pas de segments orphelins.
      await run("delete from public.knowledge_chunks where source_id = $1 and project_id = $2", [sourceId, projectId]);
      return { ok: false, reason: "not_processing", fileDeleted: false };
    }
  } catch {
    try {
      await run("delete from public.knowledge_chunks where source_id = $1 and project_id = $2", [sourceId, projectId]);
    } catch {
      // Les segments partiels disparaîtront avec la source (clé étrangère `on delete cascade`).
    }
    return fail("insert_failed");
  }

  return { ok: true, chunks: chunks.length };
}
