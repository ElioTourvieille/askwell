import type { Project } from "@askwell/shared";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { freePlanLimitMessage } from "../../lib/projects-ui/limit-message";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectItem } from "./ProjectItem";
import { ProjectsManager } from "./ProjectsManager";

const project: Project = {
  id: "0b0f6f7e-3c5a-4d0e-9a52-7b1c3e1d2f10",
  name: "<img src=x onerror=alert(1)>",
  publicKey: "pk_abc",
  messagesUsed: 3,
  periodStart: "2026-11-01T00:00:00.000Z",
  createdAt: "2026-11-18T10:00:00.000Z",
};
const noop = async () => null;

describe("composants projets", () => {
  it("état vide : invite à créer le premier projet", () => {
    const html = renderToStaticMarkup(h(ProjectsManager, { initialProjects: [] }));
    expect(html).toContain("Aucun projet pour l&#x27;instant");
    expect(html).toContain("Créer le projet");
  });

  it("liste : nom, date, messages, lien Installer ; le nom est du texte, jamais du HTML", () => {
    const html = renderToStaticMarkup(h(ProjectsManager, { initialProjects: [project] }));
    expect(html).toContain(`href="/dashboard/projects/${project.id}/install"`);
    expect(html).toContain("18 novembre 2026");
    expect(html).toContain("3 messages utilisés");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  it("création refusée par la limite : le message est annoncé (role=alert)", () => {
    const html = renderToStaticMarkup(h(CreateProjectForm, { onCreate: noop, initialError: freePlanLimitMessage() }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Le forfait gratuit permet 1 projet.");
  });

  it("création réussie : aucune erreur affichée", () => {
    const html = renderToStaticMarkup(h(CreateProjectForm, { onCreate: noop }));
    expect(html).not.toContain('role="alert"');
  });

  it("suppression : demande une confirmation", () => {
    const html = renderToStaticMarkup(
      h(ProjectItem, { project, onRename: noop, onDelete: noop, initialMode: "confirm-delete" }),
    );
    expect(html).toContain("Supprimer définitivement");
    expect(html).toContain("Cette action");
  });
});
