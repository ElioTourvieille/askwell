import { APP_NAME } from "@askwell/shared";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-glass-border px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} {APP_NAME}</p>
        <nav aria-label="Pied de page" className="flex gap-4">
          <Link href="/sign-in" className="inline-flex min-h-touch items-center hover:text-fg focus-visible:outline-2 focus-visible:outline-focus">
            Se connecter
          </Link>
          <Link href="/sign-up" className="inline-flex min-h-touch items-center hover:text-fg focus-visible:outline-2 focus-visible:outline-focus">
            S&apos;inscrire
          </Link>
        </nav>
      </div>
    </footer>
  );
}
