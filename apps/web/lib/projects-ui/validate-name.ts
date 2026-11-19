import { CreateProjectRequestSchema } from "@askwell/shared";

export const NAME_ERROR = "Le nom du projet est requis (1 à 100 caractères).";

/** Valide le nom avec le schéma du contrat (`packages/shared`) ; le serveur reste seul juge. */
export function validateProjectName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const parsed = CreateProjectRequestSchema.safeParse({ name: raw });
  return parsed.success ? { ok: true, name: parsed.data.name } : { ok: false, message: NAME_ERROR };
}
