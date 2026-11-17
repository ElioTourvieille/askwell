import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createServiceClient } from "./service";

const SECRET = ["SUPABASE", "SECRET", "KEY"].join("_");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createServiceClient", () => {
  it("lève une erreur claire si la clé secrète est absente", () => {
    vi.stubEnv(SECRET, "");
    expect(() => createServiceClient()).toThrow(new RegExp(`${SECRET} est absente`));
  });

  it("lève une erreur claire si l'URL est absente", () => {
    vi.stubEnv(SECRET, "cle-de-test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createServiceClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL est absente/);
  });

  it("crée un client quand tout est défini", () => {
    vi.stubEnv(SECRET, "cle-de-test");
    expect(createServiceClient()).toBeDefined();
  });
});
