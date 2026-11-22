import { ApiErrorSchema, ConversationThreadResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const convChain = { eq: vi.fn(() => ({ maybeSingle })) };
  const msgChain = { eq: vi.fn(), order: vi.fn() };
  msgChain.eq.mockImplementation(() => msgChain);
  msgChain.order.mockImplementation(() => msgChain);
  const from = vi.fn((table: string) => ({ select: () => (table === "conversations" ? convChain : msgChain) }));
  return { auth: vi.fn(), createService: vi.fn(), maybeSingle, msgChain, from };
});
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../lib/db/owner", () => ({ createOwnerClient: async () => ({ from: m.from }) }));
vi.mock("../../../../lib/db/service", () => ({ createServiceClient: m.createService }));

import { GET } from "./route";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71";
const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id = ID) => GET(new Request(`http://localhost/api/conversations/${id}`), ctx(id));

/** `order` est appelé deux fois ; le dernier appel doit rendre les lignes. */
function mockMessages(rows: unknown[] | null, error: { message: string } | null = null) {
  let calls = 0;
  m.msgChain.order.mockImplementation(() => (++calls === 2 ? Promise.resolve({ data: rows, error }) : m.msgChain));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.auth.mockResolvedValue({ userId: "user_a" });
  m.maybeSingle.mockResolvedValue({ data: { id: ID, created_at: "2026-11-20T10:00:00+00:00" }, error: null });
  mockMessages([]);
});

describe("GET /api/conversations/:id", () => {
  it("renvoie le fil chronologique, rôles visitor/bot", async () => {
    mockMessages([
      { id: M1, role: "visitor", body: "Salut", created_at: "2026-11-20T10:00:01+00:00" },
      { id: M2, role: "bot", body: "Bonjour !", created_at: "2026-11-20T10:00:02+00:00" },
    ]);
    const res = await get();
    expect(res.status).toBe(200);
    const body = ConversationThreadResponseSchema.parse(await res.json());
    expect(body.messages.map((x) => x.role)).toEqual(["visitor", "bot"]);
    expect(m.msgChain.eq).toHaveBeenCalledWith("conversation_id", ID);
    expect(m.msgChain.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
  });

  it("404 (pas 403) pour la conversation d'un autre propriétaire ou inconnue, sans lire les messages", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(m.from).toHaveBeenCalledTimes(1);
  });

  it("404 pour un identifiant qui n'est pas un UUID", async () => {
    expect((await get("nope")).status).toBe(404);
    expect(m.from).not.toHaveBeenCalled();
  });

  it("401 sans session", async () => {
    m.auth.mockResolvedValue({ userId: null });
    expect((await get()).status).toBe(401);
  });

  it("500 sur erreur de base, sans client de service", async () => {
    mockMessages(null, { message: "boom" });
    expect((await get()).status).toBe(500);
    expect(m.createService).not.toHaveBeenCalled();
  });
});
