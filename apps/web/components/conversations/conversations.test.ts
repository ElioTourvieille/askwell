import type { ConversationSummary, Message } from "@askwell/shared";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fetchConversations, fetchThread } from "../../lib/conversations-ui/conversations-api";
import {
  formatConversationTime,
  formatMessageCount,
  previewOrFallback,
  roleLabel,
} from "../../lib/conversations-ui/format";
import { ProjectItem } from "../projects/ProjectItem";
import { ConversationsManager } from "./ConversationsManager";
import { ConversationThread } from "./ConversationThread";

const PROJECT_ID = "0b0f6f7e-3c5a-4d0e-9a52-7b1c3e1d2f10";
const CONV_ID = "5d3b5b5e-1d7f-4a1e-8f55-0c2f6a9e7b11";
const summary = (over: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: CONV_ID,
  firstMessagePreview: "Bonjour, quels sont vos horaires ?",
  messageCount: 2,
  createdAt: "2026-11-23T14:05:00.000Z",
  ...over,
});
const message = (over: Partial<Message> = {}): Message => ({
  id: "11111111-1111-4111-8111-111111111111",
  role: "visitor",
  body: "Salut",
  createdAt: "2026-11-23T14:05:00.000Z",
  ...over,
});
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("formatage", () => {
  it("compte les messages au singulier et au pluriel", () => {
    expect(formatMessageCount(1)).toBe("1 message");
    expect(formatMessageCount(12)).toBe("12 messages");
  });

  it("formate l'heure dans le fuseau demandé, vide si la date est invalide", () => {
    expect(formatConversationTime("2026-11-23T14:05:00.000Z", "UTC")).toContain("14:05");
    expect(formatConversationTime("pas une date")).toBe("");
  });

  it("nomme les rôles et remplace un aperçu vide", () => {
    expect(roleLabel("visitor")).toBe("Visiteur");
    expect(roleLabel("bot")).toBe("Assistant");
    expect(previewOrFallback("   ")).toBe("(Message vide)");
    expect(previewOrFallback("Salut")).toBe("Salut");
  });
});

describe("rendu de la page", () => {
  it("liste : aperçu, nombre de messages et heure", () => {
    const html = renderToStaticMarkup(
      h(ConversationsManager, {
        projectId: PROJECT_ID,
        timeZone: "UTC",
        initialList: { status: "ready", conversations: [summary()] },
      }),
    );
    expect(html).toContain("Bonjour, quels sont vos horaires ?");
    expect(html).toContain("2 messages");
    expect(html).toContain("14:05");
    expect(html).toContain("Actualiser");
    expect(html).toContain("Choisissez une conversation");
  });

  it("état vide, chargement et erreur", () => {
    const render = (initialList: Parameters<typeof ConversationsManager>[0]["initialList"]) =>
      renderToStaticMarkup(h(ConversationsManager, { projectId: PROJECT_ID, initialList }));
    expect(render({ status: "ready", conversations: [] })).toContain("Aucune conversation pour l&#x27;instant");
    expect(render({ status: "loading" })).toContain("Chargement des conversations");
    const error = render({ status: "error", message: "Connexion impossible." });
    expect(error).toContain('role="alert"');
    expect(error).toContain("Connexion impossible.");
  });

  it("fil : visiteur et bot ont deux styles distincts", () => {
    const html = renderToStaticMarkup(
      h(ConversationThread, {
        timeZone: "UTC",
        messages: [
          message(),
          message({ id: "22222222-2222-4222-8222-222222222222", role: "bot", body: "Nous ouvrons à 9 h." }),
        ],
      }),
    );
    expect(html).toContain('data-role="visitor"');
    expect(html).toContain('data-role="bot"');
    expect(html).toContain("Visiteur");
    expect(html).toContain("Assistant");
    expect(html).toContain("bg-primary");
  });

  it("un message contenant du HTML ou du markdown s'affiche comme texte", () => {
    const html = renderToStaticMarkup(
      h(ConversationThread, {
        messages: [
          message({ body: "<img src=x onerror=alert(1)>" }),
          message({ id: "22222222-2222-4222-8222-222222222222", role: "bot", body: "**gras** <b>x</b>" }),
        ],
      }),
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("**gras** &lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<strong>");
  });

  it("un aperçu contenant du HTML est échappé dans la liste", () => {
    const html = renderToStaticMarkup(
      h(ConversationsManager, {
        projectId: PROJECT_ID,
        initialList: { status: "ready", conversations: [summary({ firstMessagePreview: "<script>alert(1)</script>" })] },
      }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("appels API", () => {
  it("fetchConversations renvoie la liste validée", async () => {
    const calls: string[] = [];
    const result = await fetchConversations((url) => {
      calls.push(String(url));
      return json({ conversations: [summary()] });
    }, PROJECT_ID);
    expect(calls).toEqual([`/api/projects/${PROJECT_ID}/conversations`]);
    expect(result).toEqual({ ok: true, data: [summary()] });
  });

  it("fetchThread renvoie le fil, et le message d'erreur de l'API sinon", async () => {
    const ok = await fetchThread(() => json({ id: CONV_ID, createdAt: summary().createdAt, messages: [message()] }), CONV_ID);
    expect(ok.ok && ok.data.messages).toHaveLength(1);

    const notFound = await fetchThread(
      () => json({ error: { code: "not_found", message: "Conversation introuvable." } }, 404),
      CONV_ID,
    );
    expect(notFound).toEqual({ ok: false, message: "Conversation introuvable." });
  });

  it("réseau coupé ou réponse inattendue : message générique", async () => {
    const network = await fetchConversations(() => Promise.reject(new Error("offline")), PROJECT_ID);
    expect(network.ok).toBe(false);
    const invalid = await fetchConversations(() => json({ nope: true }), PROJECT_ID);
    expect(invalid).toEqual({ ok: false, message: "Une erreur est survenue. Réessayez dans un instant." });
  });
});

describe("tableau de bord", () => {
  it("ProjectItem propose le lien « Conversations » vers la page du projet", () => {
    const html = renderToStaticMarkup(
      h(ProjectItem, {
        project: { id: PROJECT_ID, name: "Mon site", messagesUsed: 0, createdAt: "2026-11-23T10:00:00.000Z" } as never,
        onRename: async () => null,
        onDelete: async () => null,
      }),
    );
    expect(html).toContain(`href="/dashboard/projects/${PROJECT_ID}/conversations"`);
    expect(html).toContain("Conversations");
  });
});
