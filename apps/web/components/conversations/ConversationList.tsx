import type { ConversationSummary } from "@askwell/shared";
import { formatConversationTime, formatMessageCount, previewOrFallback } from "../../lib/conversations-ui/format";
import { cx } from "../ui/cx";

type Props = {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  timeZone?: string;
};

export function ConversationList({ conversations, selectedId, onSelect, timeZone }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((conversation) => {
        const selected = conversation.id === selectedId;
        return (
          <li key={conversation.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                "flex min-h-touch w-full min-w-0 flex-col gap-1 rounded-glass border p-4 text-left transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                selected ? "border-fg bg-surface" : "border-glass-border bg-glass hover:bg-surface",
              )}
            >
              <span className="text-sm font-medium break-words">{previewOrFallback(conversation.firstMessagePreview)}</span>
              <span className="text-xs text-muted">
                {formatMessageCount(conversation.messageCount)} · {formatConversationTime(conversation.createdAt, timeZone)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
