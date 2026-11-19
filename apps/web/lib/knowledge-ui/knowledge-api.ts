import {
  ApiErrorSchema,
  DeleteKnowledgeResponseSchema,
  FinalizeKnowledgeResponseSchema,
  KNOWLEDGE_FILE_TYPES,
  MAX_KNOWLEDGE_FILE_BYTES,
  MAX_KNOWLEDGE_TEXT_LENGTH,
  PLAN_LIMITS,
  PasteKnowledgeResponseSchema,
  UploadUrlResponseSchema,
  type KnowledgeFileType,
  type KnowledgeSource,
} from "@askwell/shared";

export type FetchLike = typeof fetch;

export type SourceResult = { ok: true; source: KnowledgeSource } | { ok: false; message: string };

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau puis réessayez.";
const UNKNOWN_ERROR = "Une erreur est survenue. Réessayez dans un instant.";
const UPLOAD_ERROR = "Le fichier n'a pas pu être envoyé. Réessayez dans un instant.";

/** « Limite atteinte : 3 sources avec le forfait gratuit, 25 avec Pro. » Les nombres viennent de `PLAN_LIMITS`. */
export function knowledgeLimitMessage(): string {
  const free = PLAN_LIMITS.free.maxKnowledgeSources;
  const pro = PLAN_LIMITS.pro.maxKnowledgeSources;
  return `Limite de sources atteinte : ${free} par projet avec le forfait gratuit, ${pro} avec Pro. Supprimez une source pour en ajouter une autre.`;
}

async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = ApiErrorSchema.safeParse(body);
  if (!parsed.success) return UNKNOWN_ERROR;
  return parsed.data.error.code === "plan_limit_reached" ? knowledgeLimitMessage() : parsed.data.error.message;
}

async function sendJson(fetcher: FetchLike, url: string, method: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetcher(url, {
      method,
      ...(body !== undefined && { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
  } catch {
    return null;
  }
}

// ---- Validation (confort : le serveur reste la seule barrière) ----

export function validateTitle(raw: string): { ok: true; title: string } | { ok: false; message: string } {
  const title = raw.trim();
  if (title.length === 0) return { ok: false, message: "Saisissez un titre." };
  if (title.length > 200) return { ok: false, message: "Le titre ne doit pas dépasser 200 caractères." };
  return { ok: true, title };
}

export function fileTypeFromName(filename: string): KnowledgeFileType | null {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return (KNOWLEDGE_FILE_TYPES as readonly string[]).includes(extension) ? (extension as KnowledgeFileType) : null;
}

export function validateFile(file: { name: string; size: number }):
  | { ok: true; type: KnowledgeFileType }
  | { ok: false; message: string } {
  const type = fileTypeFromName(file.name);
  if (!type) return { ok: false, message: "Format non pris en charge. Choisissez un fichier PDF, MD ou TXT." };
  if (file.size === 0) return { ok: false, message: "Le fichier est vide." };
  if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    return { ok: false, message: `Le fichier dépasse ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)} Mo.` };
  }
  return { ok: true, type };
}

// ---- Appels ----

/** POST /api/projects/:id/knowledge (texte collé). */
export async function submitPaste(
  fetcher: FetchLike,
  projectId: string,
  rawTitle: string,
  rawContent: string,
): Promise<SourceResult> {
  const title = validateTitle(rawTitle);
  if (!title.ok) return title;
  const content = rawContent.trim();
  if (content.length === 0) return { ok: false, message: "Collez un texte." };
  if (content.length > MAX_KNOWLEDGE_TEXT_LENGTH) {
    return { ok: false, message: `Le texte ne doit pas dépasser ${MAX_KNOWLEDGE_TEXT_LENGTH.toLocaleString("fr-FR")} caractères.` };
  }

  const response = await sendJson(fetcher, `/api/projects/${projectId}/knowledge`, "POST", {
    title: title.title,
    content,
  });
  if (!response) return { ok: false, message: NETWORK_ERROR };
  if (!response.ok) return { ok: false, message: await errorMessage(response) };
  const parsed = PasteKnowledgeResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true, source: parsed.data } : { ok: false, message: UNKNOWN_ERROR };
}

/**
 * Envoi d'un fichier : `upload-url` (réserve la source) -> PUT direct vers l'URL présignée -> `finalize`.
 * Le titre par défaut est le nom du fichier sans extension.
 */
export async function submitFile(
  fetcher: FetchLike,
  projectId: string,
  rawTitle: string,
  file: File,
): Promise<SourceResult> {
  const valid = validateFile(file);
  if (!valid.ok) return valid;
  const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
  const title = validateTitle(rawTitle.trim() === "" ? fallbackTitle : rawTitle);
  if (!title.ok) return title;

  const reserve = await sendJson(fetcher, `/api/projects/${projectId}/knowledge/upload-url`, "POST", {
    title: title.title,
    filename: file.name,
    type: valid.type,
    sizeBytes: file.size,
  });
  if (!reserve) return { ok: false, message: NETWORK_ERROR };
  if (!reserve.ok) return { ok: false, message: await errorMessage(reserve) };
  const reservation = UploadUrlResponseSchema.safeParse(await reserve.json().catch(() => null));
  if (!reservation.success) return { ok: false, message: UNKNOWN_ERROR };

  // Direct vers le stockage depuis le navigateur : pas de cookie, pas d'en-tête personnalisé.
  let put: Response;
  try {
    put = await fetcher(reservation.data.uploadUrl, { method: "PUT", body: file });
  } catch {
    return { ok: false, message: UPLOAD_ERROR };
  }
  if (!put.ok) return { ok: false, message: UPLOAD_ERROR };

  const finalize = await sendJson(fetcher, `/api/projects/${projectId}/knowledge/finalize`, "POST", {
    sourceId: reservation.data.sourceId,
  });
  if (!finalize) return { ok: false, message: NETWORK_ERROR };
  if (!finalize.ok) return { ok: false, message: await errorMessage(finalize) };
  const parsed = FinalizeKnowledgeResponseSchema.safeParse(await finalize.json().catch(() => null));
  return parsed.success ? { ok: true, source: parsed.data } : { ok: false, message: UNKNOWN_ERROR };
}

/** DELETE /api/knowledge/:id */
export async function deleteSource(
  fetcher: FetchLike,
  sourceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await sendJson(fetcher, `/api/knowledge/${sourceId}`, "DELETE");
  if (!response) return { ok: false, message: NETWORK_ERROR };
  if (!response.ok) return { ok: false, message: await errorMessage(response) };
  const parsed = DeleteKnowledgeResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true } : { ok: false, message: UNKNOWN_ERROR };
}
