import { z } from "zod";

/** Liste fermée des codes d'erreur et leur statut HTTP. */
export const ERROR_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 400,
  plan_limit_reached: 402,
  quota_exceeded: 429,
  rate_limited: 429,
  injection_blocked: 400,
  internal_error: 500,
} as const;

export type ApiErrorCode = keyof typeof ERROR_STATUS;

export const API_ERROR_CODES = Object.keys(ERROR_STATUS) as [ApiErrorCode, ...ApiErrorCode[]];

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export function apiError(code: ApiErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

export function errorStatus(code: ApiErrorCode): number {
  return ERROR_STATUS[code];
}
