/** Taille cible d'un segment, en caractères (project.md §6.4). */
export const CHUNK_SIZE = 800;
/** Recouvrement entre deux segments consécutifs, en caractères : une phrase coupée reste lisible des deux côtés. */
export const CHUNK_OVERLAP = 100;
/**
 * Plafond de segments par source (project.md §9, Cost abuse) : au-delà, la source est refusée AVANT tout appel
 * à OpenAI. Borne le nombre d'appels, la durée du traitement et le volume stocké (~1,4 million de caractères).
 */
export const MAX_CHUNKS_PER_SOURCE = 2000;
/** Segments par instruction `insert` (reste très en dessous de la limite de paramètres de Postgres). */
export const INSERT_BATCH_SIZE = 50;
