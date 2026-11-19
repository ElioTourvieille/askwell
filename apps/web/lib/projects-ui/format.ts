const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

/** Date ISO du contrat -> « 18 novembre 2026 ». Chaîne vide si la date est invalide. */
export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

/** « 0 message utilisé », « 1 message utilisé », « 12 messages utilisés ». */
export function formatMessagesUsed(count: number): string {
  return `${count} ${count > 1 ? "messages utilisés" : "message utilisé"}`;
}
