"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";

type Status = "idle" | "copied" | "failed";

/** Repli quand l'API Clipboard est refusée ou indisponible (page non sécurisée, permission refusée). */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }
    setStatus(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={copy}>
        {status === "copied" ? "Copié ✓" : "Copier"}
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
        {status === "copied" ? "Extrait copié dans le presse-papiers." : null}
        {status === "failed" ? "Copie impossible : sélectionnez l'extrait ci-dessus et copiez-le à la main." : null}
      </p>
    </div>
  );
}
