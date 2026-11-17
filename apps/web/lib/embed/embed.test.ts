import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_MESSAGE_LENGTH } from "@askwell/shared";
import { MessageList } from "../../components/embed/MessageList";
import { fakeReply } from "./fake-reply";
import { parseParentOrigin, postToParent } from "./parent";
import { getVisitorId, resetMemoryVisitorId } from "./visitor-id";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  } as Storage;
}

beforeEach(() => resetMemoryVisitorId());

describe("identifiant visiteur", () => {
  it("est réutilisé d'une visite à l'autre", () => {
    const storage = memoryStorage();
    const first = getVisitorId(() => storage);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    resetMemoryVisitorId();
    expect(getVisitorId(() => storage)).toBe(first);
  });

  it("repli en mémoire si le stockage est bloqué (sans exception)", () => {
    const blocked = () => {
      throw new DOMException("bloqué", "SecurityError");
    };
    const id = getVisitorId(blocked);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getVisitorId(blocked)).toBe(id);
  });
});

describe("rendu des messages", () => {
  it("affiche du HTML comme texte brut (jamais interprété)", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages: [
          { id: "1", role: "visitor", text: payload },
          { id: "2", role: "bot", text: payload },
        ],
        typing: false,
        accent: "#000000",
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("longueur maximale", () => {
  it("MAX_MESSAGE_LENGTH vient de packages/shared (1000)", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(1000);
  });
});

describe("origin", () => {
  it("accepte http/https et normalise en origine", () => {
    expect(parseParentOrigin("https://client.example/page?x=1")).toBe("https://client.example");
    expect(parseParentOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("refuse tout le reste", () => {
    for (const bad of [null, undefined, "", "*", "not a url", "javascript:alert(1)", "data:text/html,x", "ftp://x.test"]) {
      expect(parseParentOrigin(bad)).toBeNull();
    }
  });

  it("n'envoie jamais de message sans origine valide ; sinon cible l'origine exacte", () => {
    const parent = { postMessage: vi.fn() };
    postToParent(null, { source: "askwell", type: "close" }, parent);
    expect(parent.postMessage).not.toHaveBeenCalled();
    postToParent("https://client.example", { source: "askwell", type: "close" }, parent);
    expect(parent.postMessage).toHaveBeenCalledWith({ source: "askwell", type: "close" }, "https://client.example");
  });
});

describe("réponse factice", () => {
  it("renvoie une réponse non vide", async () => {
    vi.useFakeTimers();
    const p = fakeReply("Bonjour");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toContain("Bonjour");
    vi.useRealTimers();
  });
});
