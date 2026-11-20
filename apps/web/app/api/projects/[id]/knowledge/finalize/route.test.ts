import { ApiErrorSchema, KnowledgeSourceSchema } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePdf } from "../../../../../../lib/knowledge/pdf-fixture";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOwnedProject: vi.fn(),
  query: vi.fn(),
  embed: vi.fn(),
  readObject: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../../../lib/auth/get-owned-project", () => ({ getOwnedProject: m.getOwnedProject }));
vi.mock("../../../../../../lib/db/service", () => ({ createServiceClient: () => ({ query: m.query }) }));
vi.mock("../../../../../../lib/openai", () => ({ embedTexts: m.embed }));
vi.mock("../../../../../../lib/storage", async (original) => ({
  ...(await original<typeof import("../../../../../../lib/storage")>()),
  readObject: m.readObject,
  deleteObject: m.deleteObject,
}));

import { ObjectTooLargeError } from "../../../../../../lib/storage";
import { POST } from "./route";
import { createKit, type Kit } from "../test-kit";

let kit: Kit;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown, id = kit.projectId) =>
  POST(
    new Request(`http://localhost/api/projects/${id}/knowledge/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
const text = (s: string) => new TextEncoder().encode(s);
const statusOf = async (id: string) =>
  (await kit.rows("select status, storage_key from public.knowledge_sources where id = $1", [id]))[0];
const chunksOf = async (id: string) => (await kit.rows("select 1 from public.knowledge_chunks where source_id = $1", [id])).length;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  kit = await createKit("free");
  m.auth.mockResolvedValue({ userId: kit.userId });
  m.getOwnedProject.mockResolvedValue(kit.project);
  m.query.mockImplementation((t: string, p?: unknown[]) => kit.query(t, p));
  m.embed.mockImplementation(async (texts: string[]) => texts.map(() => Array.from({ length: 1536 }, () => 0.1)));
  m.deleteObject.mockResolvedValue(undefined);
  m.readObject.mockResolvedValue(text("Nos horaires sont de 9 h à 18 h. ".repeat(60)));
});
afterEach(() => kit.close());

describe("POST /api/projects/:id/knowledge/finalize", () => {
  it("traite un fichier valide : source `ready`, segments stockés, fichier lu une seule fois", async () => {
    const id = await kit.seedSource("txt");
    const res = await post({ sourceId: id });
    expect(res.status).toBe(200);
    expect(KnowledgeSourceSchema.parse(await res.json())).toMatchObject({ id, status: "ready", type: "txt" });
    expect(await chunksOf(id)).toBeGreaterThan(0);
    expect(m.readObject).toHaveBeenCalledOnce();
    expect(m.deleteObject).not.toHaveBeenCalled();
  });

  it("traite un vrai PDF", async () => {
    const id = await kit.seedSource("pdf");
    m.readObject.mockResolvedValue(makePdf("Politique de retour : 30 jours pour changer d'avis."));
    const res = await post({ sourceId: id });
    expect(res.status).toBe(200);
    expect((await statusOf(id))?.status).toBe("ready");
  });

  it("404 pour un projet qui n'appartient pas à l'appelant : source intacte, rien de lu", async () => {
    const id = await kit.seedSource("txt");
    m.getOwnedProject.mockResolvedValue(null);
    const res = await post({ sourceId: id });
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect((await statusOf(id))?.status).toBe("uploading");
    expect(m.readObject).not.toHaveBeenCalled();
  });

  it("404 pour une source qui n'est pas dans ce projet", async () => {
    const res = await post({ sourceId: "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71" });
    expect(res.status).toBe(404);
    expect(m.readObject).not.toHaveBeenCalled();
  });

  it("appelé deux fois en même temps : une seule lecture, un seul traitement", async () => {
    const id = await kit.seedSource("txt");
    const [a, b] = await Promise.all([post({ sourceId: id }), post({ sourceId: id })]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(m.readObject).toHaveBeenCalledOnce();
    expect(m.embed).toHaveBeenCalledOnce();
    expect((await post({ sourceId: id })).status).toBe(400);
    expect(m.readObject).toHaveBeenCalledOnce();
  });

  it("refuse une source `uploading` de plus de 2 h : rien n'est lu ni traité", async () => {
    const id = await kit.seedSource("txt");
    await kit.query("update public.knowledge_sources set created_at = now() - interval '3 hours' where id = $1", [id]);
    const res = await post({ sourceId: id });
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.message).toContain("expiré");
    expect(m.readObject).not.toHaveBeenCalled();
    expect((await statusOf(id))?.status).toBe("uploading");
  });

  it("un faux PDF est refusé et son fichier supprimé", async () => {
    const id = await kit.seedSource("pdf", "projects/p/faux");
    m.readObject.mockResolvedValue(text("ceci n'est pas un PDF"));
    const res = await post({ sourceId: id });
    expect(res.status).toBe(400);
    expect(m.deleteObject).toHaveBeenCalledWith("projects/p/faux");
    expect(await statusOf(id)).toMatchObject({ status: "failed", storage_key: null });
    expect(await chunksOf(id)).toBe(0);
    expect(m.embed).not.toHaveBeenCalled();
  });

  it("un fichier trop gros à la lecture est refusé et supprimé", async () => {
    const id = await kit.seedSource("txt", "projects/p/gros");
    m.readObject.mockRejectedValue(new ObjectTooLargeError(10 * 1024 * 1024));
    const res = await post({ sourceId: id });
    expect(res.status).toBe(400);
    expect(m.deleteObject).toHaveBeenCalledWith("projects/p/gros");
    expect(await statusOf(id)).toMatchObject({ status: "failed", storage_key: null });
  });

  it("fichier jamais téléversé : la source passe `failed`, 400", async () => {
    const id = await kit.seedSource("txt");
    m.readObject.mockRejectedValue(new Error("NoSuchKey"));
    expect((await post({ sourceId: id })).status).toBe(400);
    expect((await statusOf(id))?.status).toBe("failed");
  });

  it("400 pour un identifiant invalide", async () => {
    expect((await post({ sourceId: "pas-un-uuid" })).status).toBe(400);
  });
});
