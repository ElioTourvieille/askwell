import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getOwnedProject = vi.fn();
vi.mock("../auth/get-owned-project", () => ({ getOwnedProject: (id: string) => getOwnedProject(id) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { loadInstallPage } from "./loadInstallPage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("loadInstallPage", () => {
  it("projet inexistant ou d'un autre propriétaire → 404", async () => {
    getOwnedProject.mockResolvedValue(null);
    await expect(loadInstallPage("inconnu")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOwnedProject).toHaveBeenCalledWith("inconnu");
  });

  it("projet du propriétaire → extrait avec sa clé publique", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://askwell.app/");
    getOwnedProject.mockResolvedValue({ id: "p1", public_key: "pk_abc" });
    await expect(loadInstallPage("p1")).resolves.toEqual({
      snippet: '<script src="https://askwell.app/widget.js" data-key="pk_abc"></script>',
    });
  });

  it("NEXT_PUBLIC_APP_URL absente → snippet null, jamais « undefined »", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    getOwnedProject.mockResolvedValue({ id: "p1", public_key: "pk_abc" });
    await expect(loadInstallPage("p1")).resolves.toEqual({ snippet: null });
  });

  it("aperçu Vercel sans NEXT_PUBLIC_APP_URL → extrait vers https://<VERCEL_URL>", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "askwell-git-ma-branche-tourvieilles-projects.vercel.app");
    getOwnedProject.mockResolvedValue({ id: "p1", public_key: "pk_abc" });
    await expect(loadInstallPage("p1")).resolves.toEqual({
      snippet:
        '<script src="https://askwell-git-ma-branche-tourvieilles-projects.vercel.app/widget.js" data-key="pk_abc"></script>',
    });
  });

  it("production sans NEXT_PUBLIC_APP_URL → pas d'extrait, même avec VERCEL_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "askwell-abc123.vercel.app");
    getOwnedProject.mockResolvedValue({ id: "p1", public_key: "pk_abc" });
    await expect(loadInstallPage("p1")).resolves.toEqual({ snippet: null });
  });

  it("une erreur de base remonte (pas de faux 404)", async () => {
    getOwnedProject.mockRejectedValue(new Error("db"));
    await expect(loadInstallPage("p1")).rejects.toThrow("db");
  });
});
