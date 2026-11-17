import { describe, expect, it } from "vitest";
import { ApiErrorSchema, apiError, errorStatus } from "./errors";

describe("erreurs API", () => {
  it("apiError produit { error: { code, message } } valide", () => {
    const err = apiError("not_found", "Introuvable");
    expect(err).toEqual({ error: { code: "not_found", message: "Introuvable" } });
    expect(ApiErrorSchema.safeParse(err).success).toBe(true);
  });

  it("errorStatus renvoie le statut HTTP du code", () => {
    expect(errorStatus("plan_limit_reached")).toBe(402);
    expect(errorStatus("unauthorized")).toBe(401);
    expect(errorStatus("forbidden")).toBe(403);
    expect(errorStatus("not_found")).toBe(404);
    expect(errorStatus("validation_error")).toBe(400);
    expect(errorStatus("rate_limited")).toBe(429);
    expect(errorStatus("quota_exceeded")).toBe(429);
    expect(errorStatus("injection_blocked")).toBe(400);
    expect(errorStatus("internal_error")).toBe(500);
  });

  it("refuse un code inconnu", () => {
    expect(ApiErrorSchema.safeParse({ error: { code: "boom", message: "x" } }).success).toBe(false);
  });
});
