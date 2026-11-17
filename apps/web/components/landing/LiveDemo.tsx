import { GlassPanel } from "../ui/GlassPanel";
import { Reveal } from "./Reveal";

/** Emplacement réservé : visuel statique. Le vrai widget arrive en phase 6. */
export function LiveDemo() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold">Essayez-le</h2>
        <p className="mt-3 text-center text-muted">La démonstration en direct arrive bientôt.</p>
      </Reveal>
      <Reveal delay={120}>
        <GlassPanel className="mx-auto mt-8 flex max-w-md flex-col gap-3" aria-label="Aperçu du chat">
          <p className="max-w-[85%] self-start rounded-control bg-surface px-3.5 py-2 text-sm">
            Bonjour ! Posez-moi une question sur le produit.
          </p>
          <p className="max-w-[85%] self-end rounded-control bg-primary px-3.5 py-2 text-sm text-primary-fg">
            Comment installer le chat sur mon site ?
          </p>
          <p className="max-w-[85%] self-start rounded-control bg-surface px-3.5 py-2 text-sm">
            Copiez la balise script depuis votre tableau de bord et collez-la dans votre page.
          </p>
        </GlassPanel>
      </Reveal>
    </section>
  );
}
