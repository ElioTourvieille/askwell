import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { buttonVariants } from "../ui/Button";
import { cx } from "../ui/cx";
import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight break-words sm:text-6xl">
          {APP_NAME}, l&apos;assistant qui répond à vos visiteurs
        </h1>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-6 text-lg text-muted">
          Un chat d&apos;assistance basé sur l&apos;IA, qui s&apos;appuie sur vos propres documents. Il
          s&apos;installe sur n&apos;importe quel site avec une seule balise.
        </p>
      </Reveal>
      <Reveal delay={240}>
        <Link
          href="/sign-up"
          className={cx(
            "mt-10 inline-flex min-h-touch items-center justify-center rounded-control px-6 text-base font-medium transition",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            buttonVariants.primary,
          )}
        >
          Commencer gratuitement
        </Link>
      </Reveal>
    </section>
  );
}
