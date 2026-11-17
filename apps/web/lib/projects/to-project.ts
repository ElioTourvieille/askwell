import type { Tables } from "@askwell/db";
import type { Project } from "@askwell/shared";

type ProjectRow = Tables<"projects">;

/** Date renvoyée par la base (chaîne ou `Date`, avec ou sans décalage) -> ISO 8601 en UTC (`Z`), comme le contrat. */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

/** Ligne SQL (snake_case) -> `Project` du contrat. N'expose jamais `owner_id`. */
export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    messagesUsed: row.messages_used,
    periodStart: toIso(row.period_start),
    createdAt: toIso(row.created_at),
  };
}
