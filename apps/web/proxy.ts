import { apiError, errorStatus } from "@askwell/shared";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isApiRoute, isProtectedRoute } from "./lib/auth/routes";

// Next 16 : le fichier s'appelle proxy.ts (middleware.ts est déprécié).
export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (!isProtectedRoute(pathname)) return;

  if (isApiRoute(pathname)) {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) {
      return NextResponse.json(apiError("unauthorized", "Connexion requise."), {
        status: errorStatus("unauthorized"),
      });
    }
    return;
  }

  // Page : redirige vers la connexion si pas de session.
  await auth.protect();
});

export const config = {
  matcher: [
    // Ignore les internes de Next, les fichiers statiques, /embed et /api/widget/* (publics,
    // §6.5 et §9 : dans l'iframe tierce, sans cookies, clerkMiddleware bouclerait sur le
    // handshake Clerk).
    "/((?!_next|embed(?:/|$)|api/widget(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API : tout sauf /api/widget/* (publique, appelée par le widget et l'iframe).
    "/(api(?!/widget(?:/|$))|trpc)(.*)",
  ],
};
