import { isEmbedPath } from "./lib/analytics/paths";

// Next exécute ce fichier sur toutes les pages, /embed compris. posthog-js est donc importé dynamiquement,
// seulement hors /embed : dans l'iframe, ni le script ni aucune requête PostHog ne part (B1-T01).
// Sans clés, rien ne se charge (no-op).
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (key && host && !isEmbedPath(window.location.pathname)) {
  void import("./lib/analytics/client").then(({ initPostHog }) => initPostHog(key, host));
}
