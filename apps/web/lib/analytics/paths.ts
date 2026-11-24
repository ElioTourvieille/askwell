/** /embed est l'iframe affichée sur les sites des clients : aucun script de suivi n'y est chargé (§6.5, B1-T01). */
export function isEmbedPath(pathname: string): boolean {
  return pathname === "/embed" || pathname.startsWith("/embed/");
}
