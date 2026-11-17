// @vitest-environment happy-dom
import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init, parseEmbedMessage } from "./loader";

const BASE = "https://app.askwell.test";

function makeScript(key: string | null, src = `${BASE}/widget.js`): HTMLScriptElement {
  const s = document.createElement("script");
  s.src = src;
  if (key !== null) s.setAttribute("data-key", key);
  return s;
}

function mockFetch(ok: boolean, body: unknown = DEFAULT_WIDGET_CONFIG) {
  const fn = vi.fn(async () => ({ ok, json: async () => body }) as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const hostCount = () => document.querySelectorAll("[data-askwell]").length;

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("init", () => {
  it("clé absente → rien (aucun appel réseau)", async () => {
    const f = mockFetch(true);
    await init(makeScript(null));
    expect(f).not.toHaveBeenCalled();
    expect(hostCount()).toBe(0);
  });

  it("config en erreur → rien, sans exception", async () => {
    mockFetch(false);
    await expect(init(makeScript("pk_abc"))).resolves.toBeUndefined();
    expect(hostCount()).toBe(0);
  });

  it("réponse réseau qui échoue → rien, sans exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("réseau"))));
    await expect(init(makeScript("pk_abc"))).resolves.toBeUndefined();
    expect(hostCount()).toBe(0);
  });

  it("config invalide → rien", async () => {
    mockFetch(true, { button_color: "rouge" });
    await init(makeScript("pk_abc"));
    expect(hostCount()).toBe(0);
  });

  it("appelle la config sur l'origine du script", async () => {
    const f = mockFetch(true);
    await init(makeScript("pk_abc", `${BASE}/widget.js`));
    expect(f).toHaveBeenCalledWith(`${BASE}/api/widget/config?key=pk_abc`);
    expect(hostCount()).toBe(1);
  });
});

describe("postMessage", () => {
  async function openPanel() {
    mockFetch(true);
    await init(makeScript("pk_abc"));
    const root = (document.querySelector("[data-askwell]") as HTMLElement).shadowRoot as ShadowRoot;
    (root.querySelector("button") as HTMLButtonElement).click();
    const iframe = root.querySelector("iframe") as HTMLIFrameElement;
    return { root, iframe };
  }
  const send = (origin: string, data: unknown, source: MessageEventSource | null) =>
    window.dispatchEvent(new MessageEvent("message", { origin, data, source }));
  const isOpen = (iframe: HTMLIFrameElement) => iframe.classList.contains("open");

  it("le bouton est dans une shadow root : aucun CSS ni élément global sur la page hôte", async () => {
    await openPanel();
    expect(document.head.querySelectorAll("style").length).toBe(0);
    expect(document.body.querySelector("button")).toBeNull();
  });

  it("le clic ouvre l'iframe vers /embed avec la clé et l'origine de la page", async () => {
    const { iframe } = await openPanel();
    const url = new URL(iframe.src);
    expect(url.origin).toBe(BASE);
    expect(url.pathname).toBe("/embed");
    expect(url.searchParams.get("key")).toBe("pk_abc");
    expect(url.searchParams.get("origin")).toBe(location.origin);
    expect(isOpen(iframe)).toBe(true);
  });

  it("message d'une mauvaise origine ignoré", async () => {
    const { iframe } = await openPanel();
    send("https://evil.test", { source: "askwell", type: "close" }, iframe.contentWindow);
    expect(isOpen(iframe)).toBe(true);
  });

  it("message de la bonne origine mais d'une autre fenêtre ignoré", async () => {
    const { iframe } = await openPanel();
    send(BASE, { source: "askwell", type: "close" }, window);
    expect(isOpen(iframe)).toBe(true);
  });

  it("message de forme invalide ignoré", async () => {
    const { iframe } = await openPanel();
    send(BASE, { source: "askwell", type: "inconnu" }, iframe.contentWindow);
    expect(isOpen(iframe)).toBe(true);
  });

  it("message close valide accepté : l'iframe se ferme", async () => {
    const { iframe } = await openPanel();
    send(BASE, { source: "askwell", type: "close" }, iframe.contentWindow);
    expect(iframe.classList.contains("show")).toBe(false);
  });
});

describe("parseEmbedMessage", () => {
  it("accepte close, resize, unread valides", () => {
    expect(parseEmbedMessage({ source: "askwell", type: "close" })).toEqual({ source: "askwell", type: "close" });
    expect(parseEmbedMessage({ source: "askwell", type: "resize", height: 400 })).not.toBeNull();
    expect(parseEmbedMessage({ source: "askwell", type: "unread", count: 2 })).not.toBeNull();
  });

  it("refuse tout le reste", () => {
    for (const bad of [
      null,
      "close",
      {},
      { type: "close" },
      { source: "autre", type: "close" },
      { source: "askwell", type: "inconnu" },
      { source: "askwell", type: "resize", height: "400" },
      { source: "askwell", type: "resize", height: -1 },
      { source: "askwell", type: "unread", count: 1.5 },
      { source: "askwell", type: "unread", count: -1 },
    ]) {
      expect(parseEmbedMessage(bad)).toBeNull();
    }
  });
});
