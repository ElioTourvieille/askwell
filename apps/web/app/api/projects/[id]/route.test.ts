import { ApiErrorSchema, DeleteProjectResponseSchema, ProjectSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const select = vi.fn(() => ({ maybeSingle }));
  const updateEq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const deleteEq = vi.fn();
  const del = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn(() => ({ update, delete: del }));
  return { auth: vi.fn(), getOwnedProject: vi.fn(), maybeSingle, update, updateEq, deleteEq, del, from };
});
vi.mock("@clerk/nextjs/server", () => ({ auth: m.auth }));
vi.mock("../../../../lib/auth/get-owned-project", () => ({ getOwnedProject: m.getOwnedProject }));
vi.mock("../../../../lib/db/owner", () => ({ createOwnerClient: async () => ({ from: m.from }) }));

import { DELETE, PATCH } from "./route";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71";
const ROW = {
  id: ID,
  owner_id: "user_a",
  name: "Renommé",
  public_key: "pk_abc",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-17T14:24:50+00:00",
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown) =>
  new Request(`http://localhost/api/projects/${ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const del = () => new Request(`http://localhost/api/projects/${ID}`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.auth.mockResolvedValue({ userId: "user_a" });
  m.getOwnedProject.mockResolvedValue(ROW);
});

describe("PATCH /api/projects/:id", () => {
  it("renomme un projet qui m'appartient (client propriétaire, `name` seul)", async () => {
    m.maybeSingle.mockResolvedValue({ data: ROW, error: null });
    const res = await PATCH(patch({ name: "  Renommé  " }), ctx(ID));
    expect(res.status).toBe(200);
    expect(ProjectSchema.parse(await res.json()).name).toBe("Renommé");
    expect(m.update).toHaveBeenCalledWith({ name: "Renommé" });
    expect(m.updateEq).toHaveBeenCalledWith("id", ID);
  });

  it("404 pour le projet d'un autre propriétaire, sans écrire", async () => {
    m.getOwnedProject.mockResolvedValue(null);
    const res = await PATCH(patch({ name: "Volé" }), ctx(ID));
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(m.from).not.toHaveBeenCalled();
  });

  it("404 pour un identifiant qui n'est pas un UUID", async () => {
    const res = await PATCH(patch({ name: "x" }), ctx("pas-un-uuid"));
    expect(res.status).toBe(404);
    expect(m.getOwnedProject).not.toHaveBeenCalled();
  });

  it("401 sans session", async () => {
    m.auth.mockResolvedValue({ userId: null });
    const res = await PATCH(patch({ name: "x" }), ctx(ID));
    expect(res.status).toBe(401);
    expect(m.getOwnedProject).not.toHaveBeenCalled();
  });

  it.each([["nom vide", { name: "" }], ["corps vide", {}], ["JSON invalide", "{oups"]])("400 : %s", async (_l, body) => {
    const res = await PATCH(patch(body), ctx(ID));
    expect(res.status).toBe(400);
    expect(m.from).not.toHaveBeenCalled();
  });

  it("500 interne sur erreur de base", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: { message: "panne" } });
    const res = await PATCH(patch({ name: "x" }), ctx(ID));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("supprime un projet qui m'appartient", async () => {
    m.deleteEq.mockResolvedValue({ error: null });
    const res = await DELETE(del(), ctx(ID));
    expect(res.status).toBe(200);
    expect(DeleteProjectResponseSchema.parse(await res.json())).toEqual({ id: ID });
    expect(m.deleteEq).toHaveBeenCalledWith("id", ID);
  });

  it("404 pour le projet d'un autre propriétaire, sans supprimer", async () => {
    m.getOwnedProject.mockResolvedValue(null);
    const res = await DELETE(del(), ctx(ID));
    expect(res.status).toBe(404);
    expect(m.from).not.toHaveBeenCalled();
  });

  it("401 sans session", async () => {
    m.auth.mockResolvedValue({ userId: null });
    const res = await DELETE(del(), ctx(ID));
    expect(res.status).toBe(401);
    expect(m.getOwnedProject).not.toHaveBeenCalled();
  });

  it("500 interne sur erreur de base", async () => {
    m.deleteEq.mockResolvedValue({ error: { message: "panne" } });
    const res = await DELETE(del(), ctx(ID));
    expect(res.status).toBe(500);
  });
});
