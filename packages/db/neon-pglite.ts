import { PGlite, type Transaction } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { MIGRATIONS_DIR, readMigrationFiles } from "./scripts/files.ts";
import { runMigrations, type SqlExecutor } from "./scripts/runner.ts";

/**
 * Simule ce que Neon met en place quand l'API Data est activée :
 * - rôles `anonymous` et `authenticated` (NOLOGIN) ; `authenticated` reçoit des privilèges par défaut
 *   sur les futures tables de `public` (c'est ce que les migrations doivent retirer) ;
 * - `auth.user_id()`, qui lit le claim `sub` du jeton (ici dans le réglage `request.jwt.claims`) ;
 * - pgvector, préinstallé : sur Neon, `neondb_owner` (membre de `neon_superuser`) exécute `create extension vector`
 *   lui-même ; dans pglite il n'en a pas le droit (extension non « trusted »), donc la simulation l'installe et la
 *   migration passe par `create extension if not exists` ;
 * - un propriétaire `neondb_owner` qui n'est pas superutilisateur mais a BYPASSRLS/CREATEROLE
 *   (membre simulé de `neon_superuser`) : c'est lui qui exécute les migrations.
 *
 * Simulation, pas Neon : le mécanisme exact par lequel l'API Data pose le rôle et les claims n'est pas
 * reproduit, et `app_service` n'est vérifié ici que dans le cas où le propriétaire a BYPASSRLS.
 */
const NEON_SIMULATION_SQL = `
  create role anonymous nologin;
  create role authenticated nologin;
  create role neon_superuser nologin createrole createdb bypassrls;
  create role neondb_owner login createrole createdb bypassrls;
  grant neon_superuser to neondb_owner;

  create extension vector with schema public;

  create schema auth;
  create function auth.user_id() returns text
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub' $$;

  grant usage on schema public to anonymous, authenticated;
  grant create on schema public to neondb_owner;
  grant usage on schema auth to anonymous, authenticated, neondb_owner;
  grant execute on function auth.user_id() to anonymous, authenticated, neondb_owner;

  alter default privileges for role neondb_owner in schema public
    grant select, update, insert, delete on tables to authenticated;
  alter default privileges for role neondb_owner in schema public
    grant usage, select on sequences to authenticated;
`;

export type DbSession = Transaction;

export interface NeonPglite {
  /** Connexion superutilisateur (préparation des tests). */
  db: PGlite;
  /** Exécute `fn` avec un jeton dont le claim `role` décide du rôle, comme l'API Data de Neon. */
  asToken<T>(claims: Record<string, unknown>, fn: (tx: DbSession) => Promise<T>): Promise<T>;
  /** Jeton sans claim `role` : rôle `anonymous`. */
  asAnonymous<T>(fn: (tx: DbSession) => Promise<T>): Promise<T>;
  /** Jeton Clerk du propriétaire avec `role: authenticated` ; `userId` devient `auth.user_id()`. */
  asUser<T>(userId: string, fn: (tx: DbSession) => Promise<T>): Promise<T>;
  /** Connexion serveur directe (`DATABASE_URL`) en tant que `app_service`. */
  asService<T>(fn: (tx: DbSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function executorFor(db: PGlite): SqlExecutor {
  return {
    exec: async (sql) => {
      await db.exec(sql);
    },
    query: async (sql, params) => ({ rows: (await db.query(sql, params)).rows as Record<string, unknown>[] }),
  };
}

/** Crée une base pglite en mémoire, simule Neon et applique les migrations (comme `db:migrate`). */
export async function createNeonPglite(migrationsDir: string = MIGRATIONS_DIR): Promise<NeonPglite> {
  // Charge le binaire pgvector ; l'extension est créée par NEON_SIMULATION_SQL.
  const db = new PGlite({ extensions: { vector } });
  await db.exec(NEON_SIMULATION_SQL);

  await db.exec("set role neondb_owner");
  await runMigrations(executorFor(db), readMigrationFiles(migrationsDir));
  await db.exec("reset role");

  // Le rôle et les claims ne durent que le temps de la transaction (`set local`, `is_local = true`).
  async function runAs<T>(role: string, claims: object, fn: (tx: DbSession) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${role}`);
      return fn(tx);
    });
  }

  const asToken: NeonPglite["asToken"] = (claims, fn) =>
    runAs(typeof claims.role === "string" ? claims.role : "anonymous", claims, fn);

  return {
    db,
    asToken,
    asAnonymous: (fn) => asToken({}, fn),
    asUser: (userId, fn) => asToken({ sub: userId, role: "authenticated" }, fn),
    asService: (fn) => runAs("app_service", {}, fn),
    close: () => db.close(),
  };
}
