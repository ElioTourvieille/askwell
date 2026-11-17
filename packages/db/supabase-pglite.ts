import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

/**
 * Simule les rôles et `auth.jwt()` de Supabase, avec ses privilèges par défaut
 * (tout accordé sur `public`), pour que les migrations prouvent qu'elles les retirent.
 */
const SUPABASE_SIMULATION_SQL = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create function auth.jwt() returns jsonb
    language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type DbSession = Transaction;

export interface SupabasePglite {
  /** Connexion superutilisateur (préparation des tests). */
  db: PGlite;
  /** Exécute `fn` en tant que `anon`. */
  asAnon<T>(fn: (tx: DbSession) => Promise<T>): Promise<T>;
  /** Exécute `fn` en tant que propriétaire authentifié ; `userId` devient `auth.jwt()->>'sub'`. */
  asUser<T>(userId: string, fn: (tx: DbSession) => Promise<T>): Promise<T>;
  /** Exécute `fn` en tant que `service_role` (clé secrète du serveur). */
  asService<T>(fn: (tx: DbSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Retourne les fichiers `.sql` du dossier des migrations, dans l'ordre. */
export function listMigrationFiles(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/** Crée une base pglite en mémoire, simule Supabase et applique les migrations. */
export async function createSupabasePglite(migrationsDir: string = MIGRATIONS_DIR): Promise<SupabasePglite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SIMULATION_SQL);

  for (const file of listMigrationFiles(migrationsDir)) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  // Le rôle et les claims ne durent que le temps de la transaction (`set local`, `is_local = true`).
  async function runAs<T>(role: string, claims: object | null, fn: (tx: DbSession) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
      await tx.exec(`set local role ${role}`);
      return fn(tx);
    });
  }

  return {
    db,
    asAnon: (fn) => runAs("anon", null, fn),
    asUser: (userId, fn) => runAs("authenticated", { sub: userId, role: "authenticated" }, fn),
    asService: (fn) => runAs("service_role", { role: "service_role" }, fn),
    close: () => db.close(),
  };
}
