import "server-only";
import type { Tables } from "@askwell/db";
import { PLAN_LIMITS, PLANS, type KnowledgeSource, type Plan } from "@askwell/shared";
import type { ServiceClient } from "../../../../../lib/db/service";
import type { FailureReason } from "../../../../../lib/knowledge/process-source";
import { toKnowledgeSource } from "../../../../../lib/knowledge-ui/to-source";
import type { OwnedProject } from "../../../../../lib/auth/get-owned-project";

/**
 * Aides communes aux routes des connaissances. TOUTES supposent que la route a déjà réussi `getOwnedProject`
 * (ou lu la source avec le client propriétaire) : le client de service n'est utilisé qu'après (project.md §9).
 */

export type SourceRow = Tables<"knowledge_sources">;

/** Une source `uploading` plus ancienne que cela est abandonnée (l'URL présignée ne vit que 5 min). */
export const STALE_UPLOAD_HOURS = 2;

export type ReserveFailure = "plan_limit_reached" | "project_not_found" | "account_not_found";

function isPlan(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

/**
 * Réserve une source (`uploading`). Le forfait est lu ICI, sur le serveur, jamais fourni par le client ;
 * `reserve_knowledge_source` vérifie la limite de façon atomique (project.md §9, « Plan bypass »).
 */
export async function reserveSource(
  sql: ServiceClient,
  project: OwnedProject,
  input: { title: string; type: string; storageKey: string | null },
): Promise<{ ok: true; source: SourceRow } | { ok: false; reason: ReserveFailure }> {
  const accounts = await sql.query("select plan from public.accounts where clerk_user_id = $1", [project.owner_id]);
  const plan: unknown = accounts[0]?.plan;
  if (plan === undefined) return { ok: false, reason: "account_not_found" };
  if (!isPlan(plan)) throw new Error("Forfait inconnu dans la table accounts.");

  try {
    const rows = await sql.query("select * from public.reserve_knowledge_source($1, $2, $3, $4, $5)", [
      project.id,
      input.title,
      input.type,
      input.storageKey,
      PLAN_LIMITS[plan].maxKnowledgeSources,
    ]);
    return { ok: true, source: rows[0] as SourceRow };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("plan_limit_reached")) return { ok: false, reason: "plan_limit_reached" };
    if (message.includes("project_not_found")) return { ok: false, reason: "project_not_found" };
    throw error;
  }
}

/**
 * Revendique une source : `uploading` -> `processing`, UNE seule fois (la mise à jour conditionnelle est
 * atomique : deux appels simultanés, un seul obtient la ligne). `maxAgeHours` refuse une source trop ancienne.
 */
export async function claimSource(
  sql: ServiceClient,
  projectId: string,
  sourceId: string,
  maxAgeHours?: number,
): Promise<SourceRow | null> {
  const rows = await sql.query(
    `update public.knowledge_sources set status = 'processing'
     where id = $1 and project_id = $2 and status = 'uploading'
       ${maxAgeHours === undefined ? "" : "and created_at >= now() - make_interval(hours => $3)"}
     returning *`,
    maxAgeHours === undefined ? [sourceId, projectId] : [sourceId, projectId, maxAgeHours],
  );
  return (rows[0] as SourceRow | undefined) ?? null;
}

export async function loadSource(sql: ServiceClient, projectId: string, sourceId: string): Promise<SourceRow | null> {
  const rows = await sql.query("select * from public.knowledge_sources where id = $1 and project_id = $2", [
    sourceId,
    projectId,
  ]);
  return (rows[0] as SourceRow | undefined) ?? null;
}

/** Supprime segments puis source (un échec laisse une ligne qu'on peut supprimer à nouveau). */
export async function removeSourceRows(sql: ServiceClient, projectId: string, sourceId: string): Promise<void> {
  await sql.query("delete from public.knowledge_chunks where source_id = $1 and project_id = $2", [sourceId, projectId]);
  await sql.query("delete from public.knowledge_sources where id = $1 and project_id = $2", [sourceId, projectId]);
}

export function toApiSource(row: SourceRow): KnowledgeSource {
  const source = toKnowledgeSource(row);
  if (!source) throw new Error("Source de connaissances invalide.");
  return source;
}

/** Message affiché au propriétaire pour un traitement refusé (jamais le contenu du fichier). */
export function failureMessage(reason: FailureReason): string {
  switch (reason) {
    case "empty":
      return "Le fichier est vide.";
    case "too_large":
      return "Le fichier dépasse 10 Mo.";
    case "not_pdf":
      return "Ce fichier n'est pas un PDF valide.";
    case "binary":
      return "Ce fichier n'est pas un fichier texte.";
    case "unreadable":
      return "Ce fichier est illisible.";
    case "no_text":
      return "Aucun texte exploitable n'a été trouvé.";
    case "too_much_text":
      return "Le texte est trop volumineux. Divisez-le en plusieurs sources.";
    case "not_processing":
      return "Cette source a déjà été traitée ou supprimée.";
    case "embedding_failed":
    case "insert_failed":
      return "Le traitement a échoué. Réessayez plus tard.";
  }
}

/** Échecs côté serveur (500) ; les autres sont des refus du contenu (400). */
export function isServerFailure(reason: FailureReason): boolean {
  return reason === "embedding_failed" || reason === "insert_failed";
}
