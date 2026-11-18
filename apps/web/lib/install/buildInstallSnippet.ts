/**
 * Construit l'extrait `<script>` à coller sur le site du propriétaire (project.md §6.9).
 *
 * L'extrait est du TEXTE : les valeurs sont échappées pour rester valides dans un attribut HTML,
 * et la page l'affiche comme texte (jamais en HTML interprété).
 * Renvoie `null` si `appUrl` est absente ou invalide : on n'affiche jamais un extrait cassé.
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function buildInstallSnippet(appUrl: string | null | undefined, publicKey: string): string | null {
  const trimmed = appUrl?.trim();
  if (!trimmed) return null;

  let origin: string;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    origin = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }

  return `<script src="${escapeAttribute(origin)}/widget.js" data-key="${escapeAttribute(publicKey)}"></script>`;
}
