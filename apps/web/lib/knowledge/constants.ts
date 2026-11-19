/** Taille cible d'un segment, en caractères (project.md §6.4). */
export const CHUNK_SIZE = 800;
/** Recouvrement entre deux segments consécutifs, en caractères : une phrase coupée reste lisible des deux côtés. */
export const CHUNK_OVERLAP = 100;
/** Segments par instruction `insert` (reste très en dessous de la limite de paramètres de Postgres). */
export const INSERT_BATCH_SIZE = 50;
