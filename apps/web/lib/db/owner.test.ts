import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getToken } = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ getToken }) }));

import { createOwnerClient } from "./owner";

const DATA_API_URL = "https://ep-test.apirest.test.neon.build/neondb/rest/v1";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_NEON_DATA_API_URL", DATA_API_URL);
  fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function sentHeaders(): Headers {
  const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit | undefined];
  return new Headers(init?.headers);
}

describe("createOwnerClient", () => {
  it("envoie le jeton de session Clerk du propriétaire à l'API Data de Neon", async () => {
    getToken.mockResolvedValue("jeton-clerk-de-test");
    const client = await createOwnerClient();
    await client.from("projects").select("*");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string | URL | Request];
    expect(String(url)).toContain(`${DATA_API_URL}/projects`);
    expect(sentHeaders().get("authorization")).toBe("Bearer jeton-clerk-de-test");
  });

  it("ne demande pas de modèle de jeton : c'est le jeton de session standard", async () => {
    getToken.mockResolvedValue("jeton");
    const client = await createOwnerClient();
    await client.from("projects").select("*");
    expect(getToken).toHaveBeenCalledWith();
  });

  it("n'envoie aucune requête sans session (pas de jeton, pas d'accès anonymous)", async () => {
    getToken.mockResolvedValue(null);
    const client = await createOwnerClient();
    await expect(client.from("projects").select("*")).resolves.toMatchObject({ error: expect.anything() });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lève une erreur claire si NEXT_PUBLIC_NEON_DATA_API_URL est absente", async () => {
    vi.stubEnv("NEXT_PUBLIC_NEON_DATA_API_URL", "");
    await expect(createOwnerClient()).rejects.toThrow(/NEXT_PUBLIC_NEON_DATA_API_URL est absente/);
  });
});
