"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { DashboardNav } from "./DashboardNav";

type Props = {
  appName: string;
  /** Emplacement du UserButton de Clerk (composant serveur/client passé par le layout). */
  userMenu: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ appName, userMenu, children }: Props) {
  const [open, setOpen] = useState(false);

  // Échap referme le menu mobile et rend le focus au bouton.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById("dashboard-menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-glass-border bg-glass backdrop-blur-(--blur-glass) md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:py-5">
          <span className="text-lg font-semibold break-words">{appName}</span>
          <Button
            id="dashboard-menu-toggle"
            variant="secondary"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="dashboard-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Fermer" : "Menu"}
          </Button>
        </div>
        <div id="dashboard-menu" className={`${open ? "block" : "hidden"} px-3 pb-3 md:block md:pb-0`}>
          <DashboardNav onNavigate={() => setOpen(false)} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-glass-border px-4 py-3 md:px-6">
          {userMenu}
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
