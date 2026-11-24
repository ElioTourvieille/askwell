import posthog from "posthog-js";

/** Démarre posthog-js : pages vues (y compris navigation côté client), replay de session, erreurs client. */
export function initPostHog(key: string, host: string): void {
  if (posthog.__loaded) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: "history_change",
    capture_exceptions: true,
    // Profils créés seulement après identify (utilisateur Clerk connecté), pas pour les visiteurs anonymes.
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true },
  });
}
