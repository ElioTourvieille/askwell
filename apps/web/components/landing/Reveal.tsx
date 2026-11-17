"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type State = "ssr" | "hidden" | "shown";

/**
 * Entrée discrète au défilement.
 * - Rendu serveur (et sans JavaScript) : contenu pleinement visible.
 * - Après le montage, seuls les éléments encore hors écran sont cachés, puis révélés au défilement.
 * - Les classes `motion-safe:` ne s'appliquent pas avec `prefers-reduced-motion` : rien n'est caché.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Déjà à l'écran au chargement : on ne cache rien.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} motion-safe:transition motion-safe:duration-700 ${
        state === "hidden" ? "motion-safe:translate-y-4 motion-safe:opacity-0" : ""
      }`}
    >
      {children}
    </div>
  );
}
