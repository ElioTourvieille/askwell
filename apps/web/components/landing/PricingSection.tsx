import Link from "next/link";
import { buttonVariants } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { buildPlanRows } from "./planRows";
import { Reveal } from "./Reveal";

export function PricingSection() {
  const rows = buildPlanRows();
  return (
    <section id="tarifs" className="mx-auto max-w-4xl px-4 py-16">
      <Reveal>
        <h2 className="text-center text-3xl font-semibold">Tarifs</h2>
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((plan, i) => (
          <Reveal key={plan} delay={i * 100} className="h-full">
            <Card title={plan === "free" ? "Gratuit" : "Pro"} className="h-full">
              <dl className="divide-y divide-glass-border text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-medium sm:text-right">{row[plan]}</dd>
                  </div>
                ))}
              </dl>
              {plan === "free" ? (
                <Link
                  href="/sign-up"
                  className={cx(
                    "mt-6 inline-flex min-h-touch w-full items-center justify-center rounded-control px-5 text-sm font-medium transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    buttonVariants.primary,
                  )}
                >
                  Commencer gratuitement
                </Link>
              ) : null}
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
