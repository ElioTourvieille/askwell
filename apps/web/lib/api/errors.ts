import { apiError as buildApiError, errorStatus, type ApiErrorCode } from "@askwell/shared";

/** Réponse JSON `{ error: { code, message } }` avec le statut HTTP du code (types et codes : `@askwell/shared`). */
export function apiError(code: ApiErrorCode, message: string): Response {
  return Response.json(buildApiError(code, message), { status: errorStatus(code) });
}
