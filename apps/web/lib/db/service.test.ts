import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; ici on ne teste que la logique.
vi.mock("server-only", () => ({}));

const { neon } = vi.hoisted(() => ({ neon: vi.fn((url: string) => ({ connectedTo: url })) }));
vi.mock("@neondatabase/serverless", () => ({ neon }));

import { createServiceClient } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createServiceClient", () => {
  it("lève une erreur claire si DATABASE_URL est absente", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => createServiceClient()).toThrow(/DATABASE_URL est absente/);
    expect(neon).not.toHaveBeenCalled();
  });

  it("n'inclut jamais l'URL de connexion dans l'erreur", () => {
    vi.stubEnv("DATABASE_URL", "");
    try {
      createServiceClient();
    } catch (error) {
      expect(String(error)).not.toMatch(/postgres(ql)?:\/\//);
    }
  });

  it("se connecte avec DATABASE_URL quand elle est définie", () => {
    const url = "postgresql://app_service:motdepasse-de-test@ep-test.neon.tech/neondb";
    vi.stubEnv("DATABASE_URL", url);
    expect(createServiceClient()).toEqual({ connectedTo: url });
    expect(neon).toHaveBeenCalledWith(url);
  });
});
