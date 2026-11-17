import { GlassPanel } from "../ui/GlassPanel";
import { Reveal } from "./Reveal";

const SNIPPET = `<script
  src="https://votre-domaine/widget.js"
  data-key="pk_votre_cle"
></script>`;

export function InstallSnippet() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold">Installation</h2>
        <p className="mt-3 text-center text-muted">Collez cette balise avant la fin de la page. C&apos;est tout.</p>
      </Reveal>
      <Reveal delay={120}>
        <GlassPanel className="mt-8 p-4">
          <pre className="font-mono text-sm break-all whitespace-pre-wrap">
            <code>{SNIPPET}</code>
          </pre>
        </GlassPanel>
      </Reveal>
    </section>
  );
}
