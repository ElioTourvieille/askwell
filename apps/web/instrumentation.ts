import type { Instrumentation } from "next";

/** Erreurs serveur (rendu, routes, actions) envoyées à PostHog. Sans clés : no-op. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // posthog-node ne tourne pas sur le runtime edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerException } = await import("./lib/analytics/server");
  // Seulement le chemin sans requête (pas de query, pas d'en-têtes, pas de corps) : aucune donnée personnelle.
  await captureServerException(error, undefined, {
    path: request.path.split("?")[0],
    method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
  });
};
