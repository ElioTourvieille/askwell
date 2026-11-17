import { Card } from "../ui/Card";
import { Reveal } from "./Reveal";

const STEPS = [
  { title: "1. Ajoutez vos connaissances", text: "Importez un PDF ou collez du texte : c'est la base de réponse du chat." },
  { title: "2. Copiez la balise script", text: "Une ligne à coller dans le code HTML de votre site." },
  { title: "3. Le chat répond", text: "Vos visiteurs posent leurs questions, les réponses viennent de vos documents." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold">Comment ça marche</h2>
      </Reveal>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="min-w-0">
            <Reveal delay={i * 100} className="h-full">
              <Card title={step.title} description={step.text} className="h-full" />
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
