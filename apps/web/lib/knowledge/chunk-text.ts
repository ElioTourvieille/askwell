import { CHUNK_OVERLAP, CHUNK_SIZE } from "./constants";

/** Retours à la ligne uniformes, pas de ligne vide en série, pas d'espace en bout de ligne. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Séparateurs préférés pour couper, du plus naturel au moins naturel. */
const BREAKS = ["\n\n", "\n", ". ", " "] as const;

/** Position de fin de segment : coupe sur le meilleur séparateur dans la dernière partie de la fenêtre. */
function findEnd(text: string, start: number, size: number): number {
  const hardEnd = Math.min(start + size, text.length);
  if (hardEnd === text.length) return hardEnd;
  const window = text.slice(start, hardEnd);
  const minCut = Math.floor(size * 0.5);
  for (const separator of BREAKS) {
    const at = window.lastIndexOf(separator);
    if (at >= minCut) return start + at + separator.length;
  }
  return hardEnd;
}

/**
 * Découpe un texte en segments d'environ `size` caractères, avec `overlap` caractères de recouvrement.
 * Fonction pure : aucun segment vide, ordre du texte conservé, le texte est traité comme des DONNÉES.
 */
export function chunkText(text: string, size: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("La taille d'un segment doit être un entier positif.");
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size) {
    throw new RangeError("Le recouvrement doit être un entier positif ou nul, inférieur à la taille d'un segment.");
  }

  const normalized = normalizeText(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = findEnd(normalized, start, size);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    // Toujours avancer d'au moins un caractère : pas de boucle infinie.
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
