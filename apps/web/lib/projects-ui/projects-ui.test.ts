import { PLAN_LIMITS, type Project } from "@askwell/shared";
import { describe, expect, it, vi } from "vitest";
import { formatCreatedAt, formatMessagesUsed } from "./format";
import { freePlanLimitMessage } from "./limit-message";
import { deleteProjectRequest, submitCreate, submitRename } from "./projects-api";
import { NAME_ERROR, validateProjectName } from "./validate-name";

const project: Project = {
  id: "0b0f6f7e-3c5a-4d0e-9a52-7b1c3e1d2f10",
  name: "Mon site",
  publicKey: "pk_abc",
  messagesUsed: 0,
  periodStart: "2026-11-01T00:00:00.000Z",
  createdAt: "2026-11-18T10:00:00.000Z",
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("validateProjectName", () => {
  it("rogne et accepte un nom valide", () => {
    expect(validateProjectName("  Mon site  ")).toEqual({ ok: true, name: "Mon site" });
  });
  it("refuse vide, espaces seuls et plus de 100 caractères", () => {
    for (const raw of ["", "   ", "a".repeat(101)]) {
      expect(validateProjectName(raw)).toEqual({ ok: false, message: NAME_ERROR });
    }
  });
  it("accepte 100 caractères", () => {
    expect(validateProjectName("a".repeat(100)).ok).toBe(true);
  });
});

describe("format", () => {
  it("formate la date en français (UTC)", () => {
    expect(formatCreatedAt("2026-11-18T10:00:00.000Z")).toBe("18 novembre 2026");
  });
  it("renvoie une chaîne vide pour une date invalide", () => {
    expect(formatCreatedAt("nope")).toBe("");
  });
  it("accorde le singulier et le pluriel", () => {
    expect(formatMessagesUsed(0)).toBe("0 message utilisé");
    expect(formatMessagesUsed(1)).toBe("1 message utilisé");
    expect(formatMessagesUsed(12)).toBe("12 messages utilisés");
  });
});

describe("freePlanLimitMessage", () => {
  it("lit la limite dans PLAN_LIMITS", () => {
    expect(freePlanLimitMessage()).toBe(`Le forfait gratuit permet ${PLAN_LIMITS.free.maxProjects} projet.`);
  });
});

describe("appels API", () => {
  it("création réussie : renvoie le projet et poste le nom rogné", async () => {
    const fetcher = vi.fn(() => json(project, 201));
    const result = await submitCreate(fetcher as unknown as typeof fetch, "  Mon site ");
    expect(result).toEqual({ ok: true, project });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Mon site" }) }),
    );
  });

  it("création refusée par la limite (402 du serveur) : message de limite, pas de projet", async () => {
    const fetcher = vi.fn(() => json({ error: { code: "plan_limit_reached", message: "x" } }, 402));
    const result = await submitCreate(fetcher as unknown as typeof fetch, "Second");
    expect(result).toEqual({ ok: false, message: freePlanLimitMessage() });
  });

  it("nom invalide : aucune requête n'est envoyée", async () => {
    const fetcher = vi.fn();
    const result = await submitCreate(fetcher as unknown as typeof fetch, " ");
    expect(result).toEqual({ ok: false, message: NAME_ERROR });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("autre erreur serveur : affiche le message du serveur", async () => {
    const fetcher = vi.fn(() => json({ error: { code: "internal_error", message: "Impossible de créer le projet." } }, 500));
    expect(await submitCreate(fetcher as unknown as typeof fetch, "A")).toEqual({
      ok: false,
      message: "Impossible de créer le projet.",
    });
  });

  it("réseau coupé : message lisible", async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError("fail")));
    const result = await submitCreate(fetcher as unknown as typeof fetch, "A");
    expect(result.ok).toBe(false);
  });

  it("renommage et suppression", async () => {
    const renamed = { ...project, name: "Nouveau" };
    const patch = vi.fn(() => json(renamed));
    expect(await submitRename(patch as unknown as typeof fetch, project.id, "Nouveau")).toEqual({ ok: true, project: renamed });
    const del = vi.fn(() => json({ id: project.id }));
    expect(await deleteProjectRequest(del as unknown as typeof fetch, project.id)).toEqual({ ok: true });
    const notFound = vi.fn(() => json({ error: { code: "not_found", message: "Projet introuvable." } }, 404));
    expect(await deleteProjectRequest(notFound as unknown as typeof fetch, project.id)).toEqual({
      ok: false,
      message: "Projet introuvable.",
    });
  });
});
