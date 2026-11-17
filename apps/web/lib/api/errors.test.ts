import { API_ERROR_CODES, ApiErrorSchema, errorStatus } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { apiError } from "./errors";

describe("apiError", () => {
  it("renvoie { error: { code, message } } avec le statut du code", async () => {
    const res = apiError("plan_limit_reached", "Limite atteinte");
    expect(res.status).toBe(402);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: { code: "plan_limit_reached", message: "Limite atteinte" } });
  });

  it("produit une forme valide et le bon statut pour chaque code", async () => {
    for (const code of API_ERROR_CODES) {
      const res = apiError(code, "x");
      expect(res.status).toBe(errorStatus(code));
      expect(ApiErrorSchema.safeParse(await res.json()).success).toBe(true);
    }
  });
});
