"use client";

import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Relie les événements PostHog à l'utilisateur Clerk connecté. Seul l'identifiant Clerk est envoyé :
 * ni e-mail, ni nom, ni texte de message. No-op si PostHog n'est pas démarré (pas de clés).
 */
export function PostHogIdentify() {
  const { isLoaded, user } = useUser();
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded || !posthog.__loaded) return;
    if (userId) posthog.identify(userId);
    else posthog.reset();
  }, [isLoaded, userId]);

  return null;
}
