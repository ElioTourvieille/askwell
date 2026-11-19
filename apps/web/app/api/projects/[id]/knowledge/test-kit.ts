import { fileURLToPath } from "node:url";
import { PLAN_LIMITS } from "@askwell/shared";

/**
 * Outils de test des routes des connaissances : une vraie base pglite (migrations réelles : fonction
 * `reserve_knowledge_source`, règle des 2 h, cascade, RLS), interrogée comme `app_service`.
 * Import dynamique par chemin : `packages/db/neon-pglite.ts` n'entre pas dans le typecheck de `apps/web`.
 */
const HELPER = fileURLToPath(new URL("../../../../../../../packages/db/neon-pglite.ts", import.meta.url));

type Tx = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };
type Sandbox = { asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T>; close(): Promise<void> };

export type Row = Record<string, unknown>;

export type Kit = {
  userId: string;
  projectId: string;
  /** Ligne `projects` telle que la renvoie `getOwnedProject`. */
  project: Row;
  /** Même contrat que `sql.query` du client de service : renvoie les lignes. */
  query: (text: string, params?: unknown[]) => Promise<Row[]>;
  /** Insère une source comme `upload-url` (réservée `uploading`) ; renvoie son identifiant. */
  seedSource: (type: "text" | "pdf" | "md" | "txt", storageKey?: string | null) => Promise<string>;
  rows: (sql: string, params?: unknown[]) => Promise<Row[]>;
  close: () => Promise<void>;
};

export async function createKit(plan: "free" | "pro" = "free"): Promise<Kit> {
  const { createNeonPglite } = (await import(/* @vite-ignore */ HELPER)) as { createNeonPglite: () => Promise<Sandbox> };
  const sb = await createNeonPglite();
  const query = async (text: string, params: unknown[] = []): Promise<Row[]> =>
    (await sb.asService((tx) => tx.query(text, params))).rows;

  const userId = "user_owner";
  await query("insert into public.accounts (clerk_user_id, plan) values ($1, $2)", [userId, plan]);
  const projects = await query("select * from public.create_project($1, $2, $3)", [userId, "Projet", 100]);
  const project = projects[0] ?? {};

  return {
    userId,
    projectId: String(project.id),
    project,
    query,
    rows: query,
    seedSource: async (type, storageKey = type === "text" ? null : `projects/${String(project.id)}/obj-${Math.random()}`) => {
      const rows = await query("select * from public.reserve_knowledge_source($1, $2, $3, $4, $5)", [
        project.id,
        "Source",
        type,
        storageKey,
        PLAN_LIMITS.pro.maxKnowledgeSources,
      ]);
      return String(rows[0]?.id);
    },
    close: () => sb.close(),
  };
}

