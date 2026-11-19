import { ApiErrorSchema, KnowledgeSourceSchema } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOwnedProject: vi.fn(),
  query: vi.fn(),
  embed: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../../lib/auth/get-owned-project", () => ({ getOwnedProject: m.getOwnedProject }));
vi.mock("../../../../../lib/db/service", () => ({ createServiceClient: () => ({ query: m.query }) }));
vi.mock("../../../../../lib/openai", () => ({ embedTexts: m.embed }));

import { POST } from "./route";
import { createKit, type Kit } from "./test-kit";

let kit: Kit;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown, id = kit.projectId) =>
  POST(
    new Request(`http://localhost/api/projects/${id}/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(id),
  );
const sourcesCount = async () => Number((await kit.rows("select count(*)::int as n from public.knowledge_sources"))[0]?.n);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  kit = await createKit("free");
  m.auth.mockResolvedValue({ userId: kit.userId });
  m.getOwnedProject.mockResolvedValue(kit.project);
  m.query.mockImplementation((text: string, params?: unknown[]) => kit.query(text, params));
  m.embed.mockImplementation(async (texts: string[]) => texts.map(() => Array.from({ length: 1536 }, () => 0.1)));
});
afterEach(() => kit.close());

describe("POST /api/projects/:id/knowledge (texte collé)", () => {
  it("ajoute un texte : la source passe `ready`, les segments sont stockés", async () => {
    const res = await post({ title: "FAQ", content: "Nos horaires sont de 9 h à 18 h. ".repeat(60) });
    expect(res.status).toBe(201);
    const source = KnowledgeSourceSchema.parse(await res.json());
    expect(source).toMatchObject({ title: "FAQ", type: "text", status: "ready" });
    const chunks = await kit.rows("select 1 from public.knowledge_chunks where source_id = $1", [source.id]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(m.embed).toHaveBeenCalledOnce();
  });

  it("404 pour un projet qui n'appartient pas à l'appelant : rien n'est réservé ni embarqué", async () => {
    m.getOwnedProject.mockResolvedValue(null);
    const res = await post({ title: "FAQ", content: "texte" });
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(await sourcesCount()).toBe(0);
    expect(m.query).not.toHaveBeenCalled();
    expect(m.embed).not.toHaveBeenCalled();
  });

  it("402 `plan_limit_reached` à la 4e source du forfait Gratuit (limite lue côté serveur)", async () => {
    for (const title of ["A", "B", "C"]) expect((await post({ title, content: `texte ${title}` })).status).toBe(201);
    m.embed.mockClear();
    // Un client qui prétend être Pro n'y change rien : le forfait vient de la base.
    const res = await post({ title: "D", content: "texte D", plan: "pro", maxKnowledgeSources: 99 });
    expect(res.status).toBe(402);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("plan_limit_reached");
    expect(await sourcesCount()).toBe(3);
    expect(m.embed).not.toHaveBeenCalled();
  });

  it("400 pour un corps invalide, 401 sans session", async () => {
    expect((await post({ title: "", content: "x" })).status).toBe(400);
    expect((await post("pas du json")).status).toBe(400);
    m.auth.mockResolvedValue({ userId: null });
    expect((await post({ title: "A", content: "x" })).status).toBe(401);
  });

  it("échec des représentations : 500 et aucun emplacement du forfait consommé", async () => {
    m.embed.mockRejectedValue(new Error("openai indisponible"));
    const res = await post({ title: "FAQ", content: "texte utile" });
    expect(res.status).toBe(500);
    expect(await sourcesCount()).toBe(0);
  });
});
