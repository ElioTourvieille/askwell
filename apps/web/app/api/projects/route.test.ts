import { ApiErrorSchema, ListProjectsResponseSchema, ProjectSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, createProject, order, from } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  return { auth: vi.fn(), createProject: vi.fn(), order, select, from: vi.fn(() => ({ select })) };
});
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("../../../lib/db/owner", () => ({ createOwnerClient: async () => ({ from }) }));
vi.mock("../../../lib/projects/create-project", () => ({ createProject }));

import { GET, POST } from "./route";

const ROW = {
  id: "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71",
  owner_id: "user_a",
  name: "Mon site",
  public_key: "pk_abc",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-17T14:24:50+00:00",
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.mockResolvedValue({ userId: "user_a" });
});

describe("GET /api/projects", () => {
  it("liste les projets du propriétaire via le client propriétaire", async () => {
    order.mockResolvedValue({ data: [ROW], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = ListProjectsResponseSchema.parse(await res.json());
    expect(body.projects).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("owner_id");
    expect(from).toHaveBeenCalledWith("projects");
  });

  it("401 sans session, sans interroger la base", async () => {
    auth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
    expect(from).not.toHaveBeenCalled();
  });

  it("500 interne sans fuite du message de base", async () => {
    order.mockResolvedValue({ data: null, error: { message: "secret interne" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret interne");
  });
});

describe("POST /api/projects", () => {
  it("crée le projet (201) avec l'identifiant de la SESSION, jamais celui du corps", async () => {
    createProject.mockResolvedValue({ ok: true, project: ROW });
    const res = await POST(post({ name: "  Mon site  ", ownerId: "user_pirate", owner_id: "user_pirate" }));
    expect(res.status).toBe(201);
    ProjectSchema.parse(await res.json());
    expect(createProject).toHaveBeenCalledWith("user_a", "Mon site");
  });

  it("402 plan_limit_reached quand la limite du forfait est atteinte", async () => {
    createProject.mockResolvedValue({ ok: false, reason: "plan_limit_reached" });
    const res = await POST(post({ name: "Deuxième" }));
    expect(res.status).toBe(402);
    const { error } = ApiErrorSchema.parse(await res.json());
    expect(error.code).toBe("plan_limit_reached");
    expect(error.message).toMatch(/maximum de projets/);
  });

  it("404 clair quand le compte est absent", async () => {
    createProject.mockResolvedValue({ ok: false, reason: "account_not_found" });
    const res = await POST(post({ name: "Mon site" }));
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.message).toMatch(/Compte introuvable/);
  });

  it("401 sans session", async () => {
    auth.mockResolvedValue({ userId: null });
    const res = await POST(post({ name: "Mon site" }));
    expect(res.status).toBe(401);
    expect(createProject).not.toHaveBeenCalled();
  });

  it.each([["corps vide", {}], ["nom vide", { name: "   " }], ["nom trop long", { name: "x".repeat(101) }], ["JSON invalide", "{pas du json"]])(
    "400 validation_error : %s",
    async (_label, body) => {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation_error");
      expect(createProject).not.toHaveBeenCalled();
    },
  );

  it("500 interne sur erreur inattendue", async () => {
    createProject.mockRejectedValue(new Error("panne"));
    const res = await POST(post({ name: "Mon site" }));
    expect(res.status).toBe(500);
  });
});
