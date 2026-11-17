/**
 * En-têtes de la route publique du widget (project.md §9, « CORS »). Le widget tourne sur le site du client,
 * donc `*` : la route ne renvoie que la configuration, sans cookie ni identifiant. GET uniquement.
 */
export const WIDGET_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  // Une couleur modifiée dans le tableau de bord doit apparaître au rechargement.
  "Cache-Control": "no-store",
} as const;

/** Ajoute les en-têtes du widget à une réponse (succès comme erreur : le chargeur doit pouvoir lire le 404). */
export function withWidgetHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(WIDGET_CORS_HEADERS)) response.headers.set(name, value);
  return response;
}
