import {
  ApiErrorSchema,
  CreateProjectResponseSchema,
  DeleteProjectResponseSchema,
  RenameProjectResponseSchema,
  type Project,
} from "@askwell/shared";
import { freePlanLimitMessage } from "./limit-message";
import { validateProjectName } from "./validate-name";

export type FetchLike = typeof fetch;

export type ApiResult = { ok: true; project: Project } | { ok: false; message: string };

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau puis réessayez.";
const UNKNOWN_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

/** Message affiché pour un refus du serveur. La limite du forfait est reformulée côté interface (texte seul). */
async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = ApiErrorSchema.safeParse(body);
  if (!parsed.success) return UNKNOWN_ERROR;
  return parsed.data.error.code === "plan_limit_reached" ? freePlanLimitMessage() : parsed.data.error.message;
}

async function send(fetcher: FetchLike, url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetcher(url, { ...init, headers: { "content-type": "application/json" } });
  } catch {
    return null;
  }
}

export async function createProjectRequest(fetcher: FetchLike, name: string): Promise<ApiResult> {
  const response = await send(fetcher, "/api/projects", { method: "POST", body: JSON.stringify({ name }) });
  if (!response) return { ok: false, message: NETWORK_ERROR };
  if (!response.ok) return { ok: false, message: await errorMessage(response) };
  const parsed = CreateProjectResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true, project: parsed.data } : { ok: false, message: UNKNOWN_ERROR };
}

export async function renameProjectRequest(fetcher: FetchLike, id: string, name: string): Promise<ApiResult> {
  const response = await send(fetcher, `/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
  if (!response) return { ok: false, message: NETWORK_ERROR };
  if (!response.ok) return { ok: false, message: await errorMessage(response) };
  const parsed = RenameProjectResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true, project: parsed.data } : { ok: false, message: UNKNOWN_ERROR };
}

export async function deleteProjectRequest(
  fetcher: FetchLike,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await send(fetcher, `/api/projects/${id}`, { method: "DELETE" });
  if (!response) return { ok: false, message: NETWORK_ERROR };
  if (!response.ok) return { ok: false, message: await errorMessage(response) };
  const parsed = DeleteProjectResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true } : { ok: false, message: UNKNOWN_ERROR };
}

/** Validation du nom puis création : ce que fait le formulaire. */
export async function submitCreate(fetcher: FetchLike, rawName: string): Promise<ApiResult> {
  const valid = validateProjectName(rawName);
  return valid.ok ? createProjectRequest(fetcher, valid.name) : { ok: false, message: valid.message };
}

/** Validation du nom puis renommage. */
export async function submitRename(fetcher: FetchLike, id: string, rawName: string): Promise<ApiResult> {
  const valid = validateProjectName(rawName);
  return valid.ok ? renameProjectRequest(fetcher, id, valid.name) : { ok: false, message: valid.message };
}
