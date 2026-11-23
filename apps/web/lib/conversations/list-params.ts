import { z } from "zod";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** Paramètres d'URL de GET /api/projects/:id/conversations : `limit` (défaut 50, plafond 100) et `offset`. */
export const ListConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

/** Lit la query string ; une valeur absente prend sa valeur par défaut, une valeur invalide est refusée. */
export function parseListQuery(url: string) {
  const params = new URL(url).searchParams;
  const raw: Record<string, string> = {};
  for (const key of ["limit", "offset"]) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  return ListConversationsQuerySchema.safeParse(raw);
}
