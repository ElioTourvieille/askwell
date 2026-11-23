import type { Message } from "@askwell/shared";

/** « 23 nov. 2026, 14:05 ». Le fuseau est celui du navigateur ; les tests le fixent explicitement. */
export function formatConversationTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", ...(timeZone && { timeZone }) }).format(
    date,
  );
}

/** « 1 message », « 12 messages ». */
export function formatMessageCount(count: number): string {
  return `${count} ${count > 1 ? "messages" : "message"}`;
}

export function roleLabel(role: Message["role"]): string {
  return role === "visitor" ? "Visiteur" : "Assistant";
}

/** Aperçu vide (conversation sans message lisible) : un libellé plutôt qu'une ligne blanche. */
export function previewOrFallback(preview: string): string {
  return preview.trim() === "" ? "(Message vide)" : preview;
}
