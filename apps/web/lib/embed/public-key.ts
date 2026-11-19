import { ChatRequestSchema } from "@askwell/shared";

/**
 * Clé publique du projet, lue dans la requête de l'iframe (`/embed?key=pk_…&origin=…`).
 * Même format que `ChatRequest.key` ; renvoie `null` si elle manque ou n'a pas le bon format.
 * La clé publique n'identifie qu'un projet : elle ne donne aucun droit (project.md §9).
 */
export function readPublicKey(search: string): string | null {
  const parsed = ChatRequestSchema.shape.key.safeParse(new URLSearchParams(search).get("key"));
  return parsed.success ? parsed.data : null;
}
