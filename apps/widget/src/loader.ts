import type { WidgetConfig } from "@askwell/shared";

/** Messages iframe → chargeur (protocole figé, implémenté côté panneau par B2). */
export type EmbedMessage =
  | { source: "askwell"; type: "close" }
  | { source: "askwell"; type: "resize"; height: number }
  | { source: "askwell"; type: "unread"; count: number };

const POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"];
const ANIMATIONS = ["fade", "slide", "scale"];
const KEY_RE = /^pk_[A-Za-z0-9_-]+$/;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 700;

/** Valide la forme d'un message reçu ; renvoie null pour tout ce qui n'est pas dans le protocole. */
export function parseEmbedMessage(data: unknown): EmbedMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.source !== "askwell") return null;
  if (m.type === "close") return { source: "askwell", type: "close" };
  if (m.type === "resize" && typeof m.height === "number" && Number.isFinite(m.height) && m.height > 0) {
    return { source: "askwell", type: "resize", height: m.height };
  }
  if (m.type === "unread" && typeof m.count === "number" && Number.isInteger(m.count) && m.count >= 0) {
    return { source: "askwell", type: "unread", count: m.count };
  }
  return null;
}

/** Ne fait confiance à rien : toute réponse invalide → null (rien ne s'affiche). */
function parseConfig(raw: unknown): WidgetConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.button_color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c.button_color)) return null;
  if (typeof c.position !== "string" || !POSITIONS.includes(c.position)) return null;
  if (typeof c.animation !== "string" || !ANIMATIONS.includes(c.animation)) return null;
  if (typeof c.label !== "string" || !c.label.trim()) return null;
  if (typeof c.header_text !== "string" || typeof c.show_badge !== "boolean") return null;
  return raw as WidgetConfig;
}

function getBase(script: HTMLScriptElement): string | null {
  try {
    return new URL(script.src, location.href).origin;
  } catch {
    return null;
  }
}

/** Lance le widget. N'élève jamais d'erreur vers la page hôte. */
export async function init(script: HTMLScriptElement | null): Promise<void> {
  try {
    const key = script?.getAttribute("data-key");
    if (!script || !key || !KEY_RE.test(key)) return;
    const base = getBase(script);
    if (!base || base === "null") return;

    const res = await fetch(`${base}/api/widget/config?key=${encodeURIComponent(key)}`);
    if (!res.ok) return;
    const config = parseConfig(await res.json());
    if (!config) return;

    mount(base, key, config);
  } catch {
    // Rien ne doit casser le site hôte.
  }
}

function mount(base: string, key: string, config: WidgetConfig): void {
  const host = document.createElement("div");
  host.setAttribute("data-askwell", "");
  const root = host.attachShadow({ mode: "open" });

  const [vertical, horizontal] = config.position.split("-") as [string, string];
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial}
    .btn,.panel{position:fixed;${vertical}:20px;${horizontal}:20px;z-index:2147483647;font-family:system-ui,sans-serif}
    .btn{background:${config.button_color};color:#fff;border:0;border-radius:999px;padding:12px 20px;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .btn:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px ${config.button_color}}
    .badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:10px;background:#d92d20;color:#fff;font-size:12px;line-height:20px;text-align:center}
    .badge[hidden]{display:none}
    .panel{${vertical}:80px;width:min(380px,calc(100vw - 40px));height:560px;max-height:calc(100vh - 100px);border:0;border-radius:12px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.3);display:none;opacity:0;transition:opacity .2s ease,transform .2s ease}
    .panel.open{display:block}
    .panel.show{opacity:1;transform:none}
    .a-slide{transform:translateY(${vertical === "bottom" ? "" : "-"}24px)}
    .a-scale{transform:scale(.9);transform-origin:${vertical} ${horizontal}}
    @media (prefers-reduced-motion:reduce){.panel{transition:none}}
  `;

  const button = document.createElement("button");
  button.className = "btn";
  button.type = "button";
  button.textContent = config.label;
  button.setAttribute("aria-expanded", "false");
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.hidden = true;
  if (config.show_badge) button.appendChild(badge);

  root.append(style, button);
  document.body.appendChild(host);

  let iframe: HTMLIFrameElement | null = null;
  let isOpen = false;

  const setOpen = (open: boolean): void => {
    isOpen = open;
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.className = `panel${config.animation === "fade" ? "" : ` a-${config.animation}`}`;
        iframe.title = config.header_text;
        iframe.src = `${base}/embed?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(location.origin)}`;
        root.appendChild(iframe);
      }
      const el = iframe;
      el.classList.add("open");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
      badge.hidden = true;
    } else if (iframe) {
      const el = iframe;
      el.classList.remove("show");
      setTimeout(() => {
        if (!isOpen) el.classList.remove("open");
      }, 200);
    }
  };

  button.addEventListener("click", () => setOpen(!isOpen));

  window.addEventListener("message", (event: MessageEvent) => {
    // Double contrôle : origine de l'application ET fenêtre de notre iframe.
    if (event.origin !== base) return;
    if (!iframe || event.source !== iframe.contentWindow) return;
    const msg = parseEmbedMessage(event.data);
    if (!msg) return;
    if (msg.type === "close") setOpen(false);
    else if (msg.type === "resize") {
      iframe.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, msg.height))}px`;
    } else if (msg.type === "unread" && config.show_badge && !isOpen) {
      badge.textContent = String(msg.count);
      badge.hidden = msg.count === 0;
    }
  });
}
