import { pickPendingMigrations } from "./plan.ts";

/** Ce dont le script a besoin d'une connexion : `pg` et pglite s'y adaptent. */
export interface SqlExecutor {
  /** Exécute un script SQL, éventuellement de plusieurs instructions, sans paramètres. */
  exec(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Table de suivi. Elle est dans `public`, donc visible de l'API Data : RLS activée et aucun privilège
 * pour `anonymous` / `authenticated` (§9). Seul le propriétaire qui migre y écrit.
 */
export const SCHEMA_MIGRATIONS_SQL = `
  create table if not exists public.schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
  );
  alter table public.schema_migrations enable row level security;
  revoke all on table public.schema_migrations from public, anonymous, authenticated;
`;

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

/**
 * Applique, dans l'ordre, les migrations pas encore enregistrées. Chaque migration et l'inscription de
 * sa version forment une seule transaction : en cas d'erreur, rien n'est appliqué ni enregistré.
 * Renvoie les versions appliquées.
 */
export async function runMigrations(
  db: SqlExecutor,
  migrations: readonly Migration[],
  log: (message: string) => void = () => {},
): Promise<string[]> {
  await db.exec(SCHEMA_MIGRATIONS_SQL);

  const applied = await db.query("select version from public.schema_migrations order by version");
  const pending = pickPendingMigrations(
    migrations,
    applied.rows.map((row) => String(row.version)),
  );

  const done: string[] = [];
  for (const migration of pending) {
    log(`Application de ${migration.version}_${migration.name}…`);
    await db.exec("begin");
    try {
      await db.exec(migration.sql);
      await db.query("insert into public.schema_migrations (version) values ($1)", [migration.version]);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
    done.push(migration.version);
  }
  return done;
}
