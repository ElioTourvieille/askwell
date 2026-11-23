import type { Message } from "@askwell/shared";
import { formatConversationTime, roleLabel } from "../../lib/conversations-ui/format";
import { cx } from "../ui/cx";

type Props = { messages: Message[]; timeZone?: string };

/**
 * Fil d'une conversation. Les messages sont rendus en TEXTE (nœuds React échappés) : jamais de HTML ni de
 * markdown interprété (project.md §9). `whitespace-pre-wrap` conserve les retours à la ligne.
 */
export function ConversationThread({ messages, timeZone }: Props) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((message) => {
        const visitor = message.role === "visitor";
        return (
          <li key={message.id} className={cx("flex min-w-0 flex-col gap-1", visitor ? "items-start" : "items-end")}>
            <span className="text-xs text-muted">
              {roleLabel(message.role)} · {formatConversationTime(message.createdAt, timeZone)}
            </span>
            <p
              data-role={message.role}
              className={cx(
                "max-w-[85%] rounded-glass px-4 py-2 text-sm break-words whitespace-pre-wrap",
                visitor
                  ? "border border-glass-border bg-glass text-fg"
                  : "border border-transparent bg-primary text-primary-fg",
              )}
            >
              {message.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
