import { afterEach, describe, expect, it, vi } from "vitest";
import { PosthogConfigResponseSchema } from "@askwell/shared";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/posthog-config", () => {
  it("renvoie { key, host } conforme au schéma partagé", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(PosthogConfigResponseSchema.parse(await res.json())).toEqual({
      key: "phc_test",
      host: "https://eu.i.posthog.com",
    });
  });

  it("renvoie 404 { error } sans configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
