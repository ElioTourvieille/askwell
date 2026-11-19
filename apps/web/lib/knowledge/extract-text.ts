import { MAX_KNOWLEDGE_FILE_BYTES, type KnowledgeFileType } from "@askwell/shared";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export type RefusalReason = "empty" | "too_large" | "not_pdf" | "binary";

export type Verification = { ok: true } | { ok: false; reason: RefusalReason };

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // « %PDF- »

/**
 * Vérifie les octets RÉELS d'un fichier lu depuis le stockage (project.md §9) : taille réelle, octets
 * d'en-tête d'un PDF, absence d'octets nuls dans un MD/TXT. L'extension et la taille déclarées au
 * `upload-url` ne suffisent pas : le serveur est la seule barrière.
 */
export function verifyFile(type: KnowledgeFileType, bytes: Uint8Array): Verification {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > MAX_KNOWLEDGE_FILE_BYTES) return { ok: false, reason: "too_large" };
  if (type === "pdf") {
    return PDF_MAGIC.every((byte, i) => bytes[i] === byte) ? { ok: true } : { ok: false, reason: "not_pdf" };
  }
  return bytes.includes(0) ? { ok: false, reason: "binary" } : { ok: true };
}

export class ExtractionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExtractionError";
  }
}

/** Texte d'un fichier déjà vérifié. PDF : `unpdf` ; MD et TXT : UTF-8 (BOM retiré). */
export async function extractText(type: KnowledgeFileType, bytes: Uint8Array): Promise<string> {
  if (type !== "pdf") return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  try {
    // pdf.js prend possession du tampon : on lui passe une copie.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    throw new ExtractionError("PDF illisible.", { cause: error });
  }
}
