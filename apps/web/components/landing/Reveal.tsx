"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Entrée discrète au défilement. Les classes `motion-safe:` ne s'appliquent pas si
 * l'utilisateur demande moins d'animations : le contenu est alors affiché tout de suite.
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
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
        visible ? "opacity-100 translate-y-0" : "motion-safe:translate-y-4 motion-safe:opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
