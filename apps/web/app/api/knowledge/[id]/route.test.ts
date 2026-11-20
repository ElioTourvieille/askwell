import { ApiErrorSchema, DeleteKnowledgeResponseSchema } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  deleteObject: vi.fn(),
  ownerLookup: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../lib/db/service", () => ({ createServiceClient: () => ({ query: m.query }) }));
vi.mock("../../../../lib/db/owner", () => ({
  // Le client propriétaire ne voit que ses sources (la RLS) : simulé par `ownerLookup`.
  createOwnerClient: async () => ({
    from: () => ({
      select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: () => m.ownerLookup(id) }) }),
    }),
  }),
}));
vi.mock("../../../../lib/storage", () => ({ deleteObject: m.deleteObject }));

import { DELETE } from "./route";
import { createKit, type Kit } from "../../projects/[id]/knowledge/test-kit";

let kit: Kit;
let asOwner = true;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const del = (id: string) => DELETE(new Request(`http://localhost/api/knowledge/${id}`, { method: "DELETE" }), ctx(id));
const exists = async (id: string) => (await kit.rows("select 1 from public.knowledge_sources where id = $1", [id])).length === 1;
const chunksOf = async (id: string) => (await kit.rows("select 1 from public.knowledge_chunks where source_id = $1", [id])).length;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  asOwner = true;
  kit = await createKit("free");
  m.auth.mockResolvedValue({ userId: kit.userId });
  m.query.mockImplementation((t: string, p?: unknown[]) => kit.query(t, p));
  m.deleteObject.mockResolvedValue(undefined);
  m.ownerLookup.mockImplementation(async (id: string) => {
    if (!asOwner) return { data: null, error: null };
    const rows = await kit.rows("select id, project_id, storage_key from public.knowledge_sources where id = $1", [id]);
    return { data: rows[0] ?? null, error: null };
  });
});
afterEach(() => kit.close());

describe("DELETE /api/knowledge/:id", () => {
  it("supprime le fichier, les segments et la source", async () => {
    const id = await kit.seedSource("pdf", "projects/p/doc");
    await kit.query("update public.knowledge_sources set status = 'ready' where id = $1", [id]);
    await kit.query(
      "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, 'a', $3::public.vector)",
      [kit.projectId, id, `[${Array.from({ length: 1536 }, () => 0.1).join(",")}]`],
    );
    expect(await chunksOf(id)).toBe(1);

    const res = await del(id);
    expect(res.status).toBe(200);
    expect(DeleteKnowledgeResponseSchema.parse(await res.json()).id).toBe(id);
    expect(m.deleteObject).toHaveBeenCalledWith("projects/p/doc");
    expect(await exists(id)).toBe(false);
    expect(await chunksOf(id)).toBe(0);
  });

  it("supprime une source `uploading` (envoi interrompu) et libère son emplacement", async () => {
    await kit.seedSource("text");
    await kit.seedSource("text");
    const pending = await kit.seedSource("pdf", "projects/p/x");
    await expect(kit.rows("select * from public.reserve_knowledge_source($1,'D','text',null,3)", [kit.projectId])).rejects.toThrow();

    expect((await del(pending)).status).toBe(200);
    expect(m.deleteObject).toHaveBeenCalledWith("projects/p/x");
    expect(await exists(pending)).toBe(false);
    // Forfait Gratuit : 3 sources. La place libérée est de nouveau réservable.
    await expect(
      kit.rows("select * from public.reserve_knowledge_source($1,'D','text',null,3)", [kit.projectId]),
    ).resolves.toHaveLength(1);
  });

  it("supprime une source `failed`, texte sans fichier compris (aucun appel au stockage)", async () => {
    const id = await kit.seedSource("text");
    await kit.query("update public.knowledge_sources set status = 'failed' where id = $1", [id]);
    expect((await del(id)).status).toBe(200);
    expect(await exists(id)).toBe(false);
    expect(m.deleteObject).not.toHaveBeenCalled();
  });

  it("404 pour la source d'un autre propriétaire : rien n'est supprimé", async () => {
    const id = await kit.seedSource("pdf", "projects/p/doc");
    asOwner = false;
    const res = await del(id);
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(await exists(id)).toBe(true);
    expect(m.deleteObject).not.toHaveBeenCalled();
    expect(m.query).not.toHaveBeenCalled();
  });

  it("404 pour un identifiant invalide, 401 sans session", async () => {
    expect((await del("pas-un-uuid")).status).toBe(404);
    m.auth.mockResolvedValue({ userId: null });
    expect((await del("3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71")).status).toBe(401);
  });

  it("si le fichier ne peut pas être supprimé : 500 et la source reste (appel répétable)", async () => {
    const id = await kit.seedSource("pdf", "projects/p/doc");
    m.deleteObject.mockRejectedValue(new Error("stockage indisponible"));
    expect((await del(id)).status).toBe(500);
    expect(await exists(id)).toBe(true);
  });
});
