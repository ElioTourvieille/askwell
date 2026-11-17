import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/** Mise en page propre de l'iframe : aucun décor, fond transparent (le panneau dessine son propre fond). */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html,body{background:transparent!important;margin:0}`}</style>
      {children}
    </>
  );
}
