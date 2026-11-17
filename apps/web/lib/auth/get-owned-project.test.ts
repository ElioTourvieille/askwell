import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("../db/owner", () => ({ createOwnerClient: async () => ({ from }) }));

import { getOwnedProject } from "./get-owned-project";

const PROJECT_ID = "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOwnedProject", () => {
  it("renvoie le projet quand la RLS le laisse passer", async () => {
    const row = { id: PROJECT_ID, name: "Mon site", owner_id: "user_a" };
    maybeSingle.mockResolvedValue({ data: row, error: null });

    await expect(getOwnedProject(PROJECT_ID)).resolves.toEqual(row);
    expect(from).toHaveBeenCalledWith("projects");
    expect(eq).toHaveBeenCalledWith("id", PROJECT_ID);
  });

  it("renvoie null quand la RLS ne renvoie rien (projet d'un autre)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getOwnedProject(PROJECT_ID)).resolves.toBeNull();
  });

  it("renvoie null pour un identifiant invalide, sans interroger la base", async () => {
    await expect(getOwnedProject("pas-un-uuid")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("laisse remonter une erreur de base au lieu de répondre « pas à moi »", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "panne" } });
    await expect(getOwnedProject(PROJECT_ID)).rejects.toThrow(/panne/);
  });
});
