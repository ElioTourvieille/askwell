/**
 * `pnpm db:migrate` : applique les migrations de packages/db/migrations pas encore enregistrées
 * dans `schema_migrations`. À lancer avec la chaîne de connexion du PROPRIÉTAIRE de la base
 * (pas `app_service`), saisie dans le terminal ou passée sur l'entrée standard.
 * Jamais depuis un fichier d'environnement.
 */
import pg from "pg";
import { readConnectionString } from "./connection-string.ts";
import { readMigrationFiles } from "./files.ts";
import { runMigrations } from "./runner.ts";

async function main() {
  const connectionString = await readConnectionString(process.stdin, process.stdout);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const applied = await runMigrations(
      {
        exec: async (sql) => {
          await client.query(sql);
        },
        query: async (sql, params) => ({ rows: (await client.query(sql, params)).rows }),
      },
      readMigrationFiles(),
      (message) => console.log(message),
    );
    console.log(applied.length === 0 ? "Rien à appliquer." : `${applied.length} migration(s) appliquée(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Erreur inconnue.");
  process.exitCode = 1;
});
