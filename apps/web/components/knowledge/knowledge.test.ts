import type { KnowledgeSource, Project } from "@askwell/shared";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { knowledgeLimitMessage } from "../../lib/knowledge-ui/knowledge-api";
import { ProjectsManager } from "../projects";
import { ErrorState, LoadingState } from "../states";
import { KnowledgeItem } from "./KnowledgeItem";
import { KnowledgeManager } from "./KnowledgeManager";
import { PasteKnowledgeForm } from "./PasteKnowledgeForm";
import { UploadKnowledgeForm } from "./UploadKnowledgeForm";

const PROJECT_ID = "0b0f6f7e-3c5a-4d0e-9a52-7b1c3e1d2f10";
const source = (over: Partial<KnowledgeSource> = {}): KnowledgeSource => ({
  id: "5d3b5b5e-1d7f-4a1e-8f55-0c2f6a9e7b11",
  title: "Guide",
  type: "text",
  status: "ready",
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});
const noop = async () => null;

describe("liste des sources", () => {
  it("affiche chaque statut, dont « en cours de traitement » pour uploading", () => {
    const html = renderToStaticMarkup(
      h(KnowledgeManager, {
        projectId: PROJECT_ID,
        initialSources: [
          source({ id: "11111111-1111-4111-8111-111111111111", title: "A", status: "uploading", type: "pdf" }),
          source({ id: "22222222-2222-4222-8222-222222222222", title: "B", status: "ready" }),
          source({ id: "33333333-3333-4333-8333-333333333333", title: "C", status: "failed", type: "md" }),
        ],
      }),
    );
    expect(html).toContain("en cours de traitement");
    expect(html).toContain("prête");
    expect(html).toContain("échec du traitement");
    expect(html).toContain("PDF");
    expect(html).toContain("19 novembre 2026");
  });

  it("un titre contenant du HTML s'affiche comme texte", () => {
    const html = renderToStaticMarkup(
      h(KnowledgeManager, {
        projectId: PROJECT_ID,
        initialSources: [source({ title: "<img src=x onerror=alert(1)>" })],
      }),
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  it("état vide : invite à ajouter une source", () => {
    const html = renderToStaticMarkup(h(KnowledgeManager, { projectId: PROJECT_ID, initialSources: [] }));
    expect(html).toContain("Aucune source pour l&#x27;instant");
    expect(html).toContain("Coller du texte");
    expect(html).toContain("Téléverser un fichier");
    expect(html).toContain("Actualiser");
  });

  it("états de chargement et d'erreur de l'écran", () => {
    expect(renderToStaticMarkup(h(LoadingState))).toContain("Chargement");
    const error = renderToStaticMarkup(h(ErrorState, { text: "Impossible de charger vos sources." }));
    expect(error).toContain('role="alert"');
    expect(error).toContain("Impossible de charger vos sources.");
  });
});

describe("suppression", () => {
  it("demande une confirmation avant de supprimer", () => {
    const html = renderToStaticMarkup(
      h(KnowledgeItem, { source: source(), onDelete: noop, initialConfirming: true }),
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Supprimer définitivement");
    expect(html).toContain("Cette action est définitive");
  });

  it("sans confirmation en cours, seul le bouton Supprimer est proposé", () => {
    const html = renderToStaticMarkup(h(KnowledgeItem, { source: source(), onDelete: noop }));
    expect(html).not.toContain("alertdialog");
    expect(html).toContain("Supprimer");
  });
});

describe("formulaires", () => {
  it("limite du forfait : le message est annoncé (role=alert)", () => {
    const paste = renderToStaticMarkup(
      h(PasteKnowledgeForm, { onSubmit: noop, initialError: knowledgeLimitMessage() }),
    );
    const upload = renderToStaticMarkup(
      h(UploadKnowledgeForm, { onSubmit: noop, initialError: knowledgeLimitMessage() }),
    );
    for (const html of [paste, upload]) {
      expect(html).toContain('role="alert"');
      expect(html).toContain("Limite de sources atteinte");
    }
  });

  it("sans erreur : aucune alerte", () => {
    expect(renderToStaticMarkup(h(PasteKnowledgeForm, { onSubmit: noop }))).not.toContain('role="alert"');
    expect(renderToStaticMarkup(h(UploadKnowledgeForm, { onSubmit: noop }))).not.toContain('role="alert"');
  });

  it("le champ fichier n'accepte que PDF, MD et TXT", () => {
    const html = renderToStaticMarkup(h(UploadKnowledgeForm, { onSubmit: noop }));
    expect(html).toContain('accept=".pdf,.md,.txt"');
    expect(html).toContain("10 Mo");
  });
});

describe("lien depuis un projet", () => {
  it("la liste des projets contient un lien « Connaissances » vers la page", () => {
    const project: Project = {
      id: PROJECT_ID,
      name: "Mon site",
      publicKey: "pk_abc",
      messagesUsed: 0,
      periodStart: "2026-11-01T00:00:00.000Z",
      createdAt: "2026-11-18T10:00:00.000Z",
    };
    const html = renderToStaticMarkup(h(ProjectsManager, { initialProjects: [project] }));
    expect(html).toContain(`href="/dashboard/projects/${PROJECT_ID}/knowledge"`);
    expect(html).toContain("Connaissances");
    expect(html).toContain(`href="/dashboard/projects/${PROJECT_ID}/install"`);
  });
});
