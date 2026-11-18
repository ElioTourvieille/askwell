import { createElement as h } from "react";

export type ChatMessage = { id: string; role: "visitor" | "bot"; text: string };

type Props = { messages: ChatMessage[]; typing: boolean; accent: string };

const VISITOR =
  "ml-auto max-w-[85%] rounded-glass px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-white";
const BOT = "mr-auto max-w-[85%] rounded-glass bg-surface px-3.5 py-2 text-sm break-words whitespace-pre-wrap";

/**
 * Les messages (visiteur ET bot) sont rendus comme du TEXTE : React échappe le contenu.
 * Jamais de `dangerouslySetInnerHTML` ici (docs/project.md §9, XSS).
 * Écrit en `.ts` (createElement) pour que Vitest puisse rendre le vrai composant : la config racine
 * ne transforme pas le JSX (`jsx: preserve` dans le tsconfig de l'application).
 */
export function MessageList({ messages, typing, accent }: Props) {
  return h(
    "ul",
    { className: "flex flex-col gap-2", "aria-live": "polite", "aria-label": "Conversation" },
    messages.map((m) =>
      h(
        "li",
        {
          key: m.id,
          "data-role": m.role,
          className: m.role === "visitor" ? VISITOR : BOT,
          style: m.role === "visitor" ? { backgroundColor: accent } : undefined,
        },
        m.text,
      ),
    ),
    typing
      ? h(
          "li",
          { key: "typing", role: "status", className: "mr-auto rounded-glass bg-surface px-3.5 py-2 text-sm text-muted" },
          "En train d’écrire…",
        )
      : null,
  );
}
