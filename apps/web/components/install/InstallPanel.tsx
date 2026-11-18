import { Card } from "../ui";
import { CopyButton } from "./CopyButton";

const STEPS = [
  "Copiez l'extrait ci-dessus avec le bouton « Copier ».",
  "Collez-le dans le code de votre site, juste avant la balise </body>.",
  "Rechargez la page : le widget apparaît.",
];

export function InstallPanel({ snippet }: { snippet: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Card title="Votre extrait" description="Une seule balise à coller sur votre site.">
        {/* Texte brut : React échappe le contenu, l'extrait n'est jamais interprété comme du HTML. */}
        <pre
          tabIndex={0}
          className="overflow-x-auto rounded-control border border-glass-border bg-surface p-3 font-mono text-sm break-all whitespace-pre-wrap"
        >
          <code>{snippet}</code>
        </pre>
        <div className="mt-3">
          <CopyButton text={snippet} />
        </div>
      </Card>
      <Card title="Installation en 3 étapes">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
      <p className="text-sm text-muted">
        La clé publique (pk_…) est faite pour être visible dans le code de votre site : elle ne donne aucun droit sur
        votre compte.
      </p>
    </div>
  );
}
