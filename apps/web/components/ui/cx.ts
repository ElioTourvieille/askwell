/** Assemble des noms de classes en ignorant les valeurs vides (évite une dépendance). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
