import { PLAN_LIMITS } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db/service", () => ({ createServiceClient: () => ({ query }) }));

import { classifyCreateProjectError, createProject } from "./create-project";

const ROW = { id: "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71", name: "Mon site" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyCreateProjectError", () => {
  it("reconnaît les deux erreurs prévues de create_project", () => {
    expect(classifyCreateProjectError(new Error("plan_limit_reached"))).toBe("plan_limit_reached");
    expect(classifyCreateProjectError(new Error("account_not_found"))).toBe("account_not_found");
  });

  it("renvoie null pour une erreur inattendue", () => {
    expect(classifyCreateProjectError(new Error("connexion perdue"))).toBeNull();
    expect(classifyCreateProjectError("plan_limit_reached")).toBeNull();
  });
});

describe("createProject", () => {
  it("lit le forfait sur le serveur et passe la limite de PLAN_LIMITS à create_project", async () => {
    query.mockResolvedValueOnce([{ plan: "pro" }]).mockResolvedValueOnce([ROW]);

    await expect(createProject("user_a", "Mon site")).resolves.toEqual({ ok: true, project: ROW });
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("from public.accounts"), ["user_a"]);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("create_project"), [
      "user_a",
      "Mon site",
      PLAN_LIMITS.pro.maxProjects,
    ]);
  });

  it("utilise la limite du forfait gratuit", async () => {
    query.mockResolvedValueOnce([{ plan: "free" }]).mockResolvedValueOnce([ROW]);
    await createProject("user_a", "Mon site");
    expect(query.mock.calls[1]?.[1]).toEqual(["user_a", "Mon site", PLAN_LIMITS.free.maxProjects]);
  });

  it("répond account_not_found sans appeler create_project quand le compte n'existe pas", async () => {
    query.mockResolvedValueOnce([]);
    await expect(createProject("user_x", "Mon site")).resolves.toEqual({ ok: false, reason: "account_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("répond plan_limit_reached quand la fonction SQL refuse", async () => {
    query.mockResolvedValueOnce([{ plan: "free" }]).mockRejectedValueOnce(new Error("plan_limit_reached"));
    await expect(createProject("user_a", "Deux")).resolves.toEqual({ ok: false, reason: "plan_limit_reached" });
  });

  it("laisse remonter une erreur inattendue et un forfait inconnu", async () => {
    query.mockResolvedValueOnce([{ plan: "free" }]).mockRejectedValueOnce(new Error("panne"));
    await expect(createProject("user_a", "Mon site")).rejects.toThrow("panne");

    query.mockReset().mockResolvedValueOnce([{ plan: "enterprise" }]);
    await expect(createProject("user_a", "Mon site")).rejects.toThrow(/Forfait inconnu/);
  });
});
