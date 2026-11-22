import type { ConversationSummary, Message } from "@askwell/shared";

export const PREVIEW_MAX_CHARS = 120;

/** Aperçu court : espaces réduits, tronqué avec « … ». Du texte brut, jamais du HTML (project.md §9). */
export function toPreview(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  return chars.length <= PREVIEW_MAX_CHARS ? text : `${chars.slice(0, PREVIEW_MAX_CHARS - 1).join("").trimEnd()}…`;
}

export type ConversationListRow = {
  id: string;
  created_at: string;
  message_count: { count: number }[];
  first_messages: { body: string }[];
};

export function toSummary(row: ConversationListRow): ConversationSummary {
  return {
    id: row.id,
    firstMessagePreview: toPreview(row.first_messages[0]?.body ?? ""),
    messageCount: row.message_count[0]?.count ?? 0,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export type MessageRow = { id: string; role: string; body: string; created_at: string };

/** Une ligne dont le rôle est inconnu est écartée plutôt que d'inventer un rôle. */
export function toMessage(row: MessageRow): Message | null {
  if (row.role !== "visitor" && row.role !== "bot") return null;
  return { id: row.id, role: row.role, body: row.body, createdAt: new Date(row.created_at).toISOString() };
}
