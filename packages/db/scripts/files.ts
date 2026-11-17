import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MIGRATION_FILE_PATTERN } from "./plan.ts";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
}

/** Lit les migrations du dossier, dans l'ordre des horodatages. */
export function readMigrationFiles(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const match = MIGRATION_FILE_PATTERN.exec(file);
      if (!match?.[1] || !match[2]) throw new Error(`Nom de migration invalide : ${file}`);
      return { version: match[1], name: match[2], sql: readFileSync(join(dir, file), "utf8") };
    });
}
