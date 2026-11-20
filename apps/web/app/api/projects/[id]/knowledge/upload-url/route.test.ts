import { ApiErrorSchema, UploadUrlResponseSchema } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), getOwnedProject: vi.fn(), query: vi.fn(), createUploadUrl: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../../../lib/auth/get-owned-project", () => ({ getOwnedProject: m.getOwnedProject }));
vi.mock("../../../../../../lib/db/service", () => ({ createServiceClient: () => ({ query: m.query }) }));
vi.mock("../../../../../../lib/storage", async (original) => ({
  ...(await original<typeof import("../../../../../../lib/storage")>()),
  createUploadUrl: m.createUploadUrl,
}));

import { POST } from "./route";
import { createKit, type Kit } from "../test-kit";

let kit: Kit;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const VALID = { title: "Guide", filename: "guide.pdf", type: "pdf", sizeBytes: 1024 };
const post = (body: unknown, id = kit.projectId) =>
  POST(
    new Request(`http://localhost/api/projects/${id}/knowledge/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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
  m.createUploadUrl.mockImplementation(async (key: string) => `https://storage.test/knowledge/${key}?X-Amz-Signature=abc`);
});
afterEach(() => kit.close());

describe("POST /api/projects/:id/knowledge/upload-url", () => {
  it("réserve la source `uploading` et renvoie l'URL présignée (clé décidée par le serveur)", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);
    const { sourceId, uploadUrl } = UploadUrlResponseSchema.parse(await res.json());
    const [row] = await kit.rows("select status, type, storage_key from public.knowledge_sources where id = $1", [sourceId]);
    expect(row).toMatchObject({ status: "uploading", type: "pdf" });
    expect(String(row?.storage_key)).toMatch(new RegExp(`^projects/${kit.projectId}/[0-9a-f-]{36}$`));
    expect(String(row?.storage_key)).not.toContain("guide");
    expect(m.createUploadUrl).toHaveBeenCalledWith(row?.storage_key, "pdf");
    expect(uploadUrl).toContain(String(row?.storage_key));
  });

  it("404 pour un projet qui n'appartient pas à l'appelant : rien n'est réservé", async () => {
    m.getOwnedProject.mockResolvedValue(null);
    const res = await post(VALID);
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(await sourcesCount()).toBe(0);
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });

  it("402 `plan_limit_reached` à la 4e source du forfait Gratuit, sans URL", async () => {
    for (let i = 0; i < 3; i += 1) expect((await post({ ...VALID, title: `G${i}` })).status).toBe(201);
    m.createUploadUrl.mockClear();
    const res = await post(VALID);
    expect(res.status).toBe(402);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("plan_limit_reached");
    expect(m.createUploadUrl).not.toHaveBeenCalled();
  });

  it("un envoi abandonné depuis plus de 2 h ne compte plus dans la limite", async () => {
    for (let i = 0; i < 3; i += 1) expect((await post({ ...VALID, title: `G${i}` })).status).toBe(201);
    await kit.query("update public.knowledge_sources set created_at = now() - interval '3 hours'");
    expect((await post(VALID)).status).toBe(201);
  });

  it("400 : type inconnu, taille > 10 Mo, extension qui ne correspond pas au type", async () => {
    expect((await post({ ...VALID, type: "exe", filename: "a.exe" })).status).toBe(400);
    expect((await post({ ...VALID, sizeBytes: 10 * 1024 * 1024 + 1 })).status).toBe(400);
    expect((await post({ ...VALID, filename: "guide.exe" })).status).toBe(400);
    expect((await post({ ...VALID, filename: "guide" })).status).toBe(400);
    expect(await sourcesCount()).toBe(0);
  });

  it("URL impossible à signer : 500 et l'emplacement est libéré", async () => {
    m.createUploadUrl.mockRejectedValue(new Error("stockage absent"));
    expect((await post(VALID)).status).toBe(500);
    expect(await sourcesCount()).toBe(0);
  });
});
