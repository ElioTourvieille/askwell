import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";

/**
 * ClerkProvider limité aux pages qui ont une session (/dashboard, /sign-in, /sign-up).
 * Il ne doit jamais être monté dans le layout racine : /embed (iframe sur le site du client)
 * n'a aucune session Clerk (§6.5, §9) et ne doit charger ni clerk-js ni requête vers Clerk.
 */
export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={frFR}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
