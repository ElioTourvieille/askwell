import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations, type Migration, type SqlExecutor } from "./runner.ts";

let db: PGlite;

function executor(): SqlExecutor {
  return {
    exec: async (sql) => {
      await db.exec(sql);
    },
    query: async (sql, params) => ({ rows: (await db.query(sql, params)).rows as Record<string, unknown>[] }),
  };
}

const migration = (version: string, sql: string): Migration => ({ version, name: "test", sql });

beforeEach(async () => {
  db = new PGlite();
  // Rôles que SCHEMA_MIGRATIONS_SQL révoque (créés par l'API Data sur Neon).
  await db.exec("create role anonymous nologin; create role authenticated nologin;");
});

afterEach(async () => {
  await db.close();
});

describe("runMigrations", () => {
  it("applique les migrations dans l'ordre et enregistre leurs versions", async () => {
    const applied = await runMigrations(executor(), [
      migration("20261118000000", "create table b (id int);"),
      migration("20261117000000", "create table a (id int);"),
    ]);
    expect(applied).toEqual(["20261117000000", "20261118000000"]);

    const rows = await db.query<{ version: string }>("select version from public.schema_migrations order by version");
    expect(rows.rows.map((r) => r.version)).toEqual(["20261117000000", "20261118000000"]);
  });

  it("est idempotent : un second passage n'applique rien", async () => {
    const migrations = [migration("20261117000000", "create table a (id int);")];
    await runMigrations(executor(), migrations);
    expect(await runMigrations(executor(), migrations)).toEqual([]);
  });

  it("annule tout en cas d'erreur : ni table ni version enregistrée", async () => {
    await expect(
      runMigrations(executor(), [migration("20261117000000", "create table a (id int); select 1/0;")]),
    ).rejects.toThrow(/division by zero/);

    const table = await db.query("select 1 from pg_tables where tablename = 'a'");
    expect(table.rows).toHaveLength(0);
    const versions = await db.query("select version from public.schema_migrations");
    expect(versions.rows).toHaveLength(0);
  });

  it("s'arrête à la première migration en erreur et garde les précédentes", async () => {
    await expect(
      runMigrations(executor(), [
        migration("20261117000000", "create table a (id int);"),
        migration("20261118000000", "select 1/0;"),
        migration("20261119000000", "create table c (id int);"),
      ]),
    ).rejects.toThrow();

    const versions = await db.query<{ version: string }>("select version from public.schema_migrations");
    expect(versions.rows.map((r) => r.version)).toEqual(["20261117000000"]);
    expect((await db.query("select 1 from pg_tables where tablename = 'c'")).rows).toHaveLength(0);
  });
});
