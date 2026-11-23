import { ApiErrorSchema, ListConversationsResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const range = vi.fn();
  const chain = { eq: vi.fn(), order: vi.fn(), limit: vi.fn(), range };
  for (const fn of [chain.eq, chain.order, chain.limit]) fn.mockImplementation(() => chain);
  const select = vi.fn(() => chain);
  const from = vi.fn(() => ({ select }));
  return { auth: vi.fn(), getOwnedProject: vi.fn(), createService: vi.fn(), chain, range, select, from };
});
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../../lib/auth/get-owned-project", () => ({ getOwnedProject: m.getOwnedProject }));
vi.mock("../../../../../lib/db/owner", () => ({ createOwnerClient: async () => ({ from: m.from }) }));
vi.mock("../../../../../lib/db/service", () => ({ createServiceClient: m.createService }));

import { GET } from "./route";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71";
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (qs = "") => GET(new Request(`http://localhost/api/projects/${ID}/conversations${qs}`), ctx(ID));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.auth.mockResolvedValue({ userId: "user_a" });
  m.getOwnedProject.mockResolvedValue({ id: ID, owner_id: "user_a" });
  m.range.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/projects/:id/conversations", () => {
  it("renvoie les conversations du propriétaire avec aperçu, compteur et date", async () => {
    m.range.mockResolvedValue({
      data: [
        { id: C2, created_at: "2026-11-21T10:00:00+00:00", message_count: [{ count: 3 }], first_messages: [{ body: "x".repeat(300) }] },
        { id: C1, created_at: "2026-11-20T10:00:00+00:00", message_count: [{ count: 1 }], first_messages: [{ body: "Bonjour" }] },
      ],
      error: null,
    });
    const res = await get();
    expect(res.status).toBe(200);
    const body = ListConversationsResponseSchema.parse(await res.json());
    expect(body.conversations.map((c) => c.id)).toEqual([C2, C1]);
    expect(body.conversations[0]?.messageCount).toBe(3);
    expect(body.conversations[0]?.firstMessagePreview.length).toBeLessThan(300);
    expect(body.conversations[1]?.firstMessagePreview).toBe("Bonjour");
  });

  it("demande le tri du plus récent au plus ancien, filtré par projet", async () => {
    await get();
    expect(m.chain.eq).toHaveBeenCalledWith("project_id", ID);
    expect(m.chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("pagine : 50 par défaut, plafond 100, décalage respecté", async () => {
    await get();
    expect(m.range).toHaveBeenLastCalledWith(0, 49);
    await get("?limit=100&offset=200");
    expect(m.range).toHaveBeenLastCalledWith(200, 299);
  });

  it.each(["?limit=101", "?limit=0", "?limit=abc", "?offset=-1"])("400 pour %s", async (qs) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation_error");
    expect(m.range).not.toHaveBeenCalled();
  });

  it("404 pour le projet d'un autre propriétaire ou inconnu, sans lire les conversations", async () => {
    m.getOwnedProject.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(m.from).not.toHaveBeenCalled();
  });

  it("404 pour un identifiant qui n'est pas un UUID", async () => {
    const res = await GET(new Request("http://localhost/x"), ctx("nope"));
    expect(res.status).toBe(404);
    expect(m.getOwnedProject).not.toHaveBeenCalled();
  });

  it("401 sans session", async () => {
    m.auth.mockResolvedValue({ userId: null });
    expect((await get()).status).toBe(401);
  });

  it("500 sur erreur de base, sans client de service", async () => {
    m.range.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await get();
    expect(res.status).toBe(500);
    expect(m.createService).not.toHaveBeenCalled();
  });
});
