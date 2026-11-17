import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const query = vi.fn();
vi.mock("../db/service", () => ({ createServiceClient: () => ({ query }) }));

import { ensureAccount } from "./ensure-account";

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue([]);
});

describe("ensureAccount", () => {
  it("première connexion : insère une ligne accounts avec le forfait free", async () => {
    await ensureAccount("user_a");

    expect(query).toHaveBeenCalledTimes(1);
    const [text, params] = query.mock.calls[0] as [string, unknown[]];
    expect(text).toMatch(/insert into public\.accounts/i);
    expect(text).toMatch(/'free'/);
    expect(params).toEqual(["user_a"]);
  });

  it("n'accepte que l'identifiant : le forfait n'est jamais un paramètre", async () => {
    await ensureAccount("user_a");
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toHaveLength(1);
  });

  it("deuxième appel : idempotent, sans erreur ni doublon", async () => {
    await ensureAccount("user_a");
    await expect(ensureAccount("user_a")).resolves.toBeUndefined();

    const [text] = query.mock.calls[1] as [string];
    expect(text).toMatch(/on conflict \(clerk_user_id\) do nothing/i);
  });

  it("erreur de base : l'erreur est propagée", async () => {
    query.mockRejectedValue(new Error("connexion refusée"));
    await expect(ensureAccount("user_a")).rejects.toThrow("connexion refusée");
  });
});
