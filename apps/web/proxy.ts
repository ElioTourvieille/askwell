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
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Connexion requise." } },
        { status: 401 },
      );
    }
    return;
  }

  // Page : redirige vers la connexion si pas de session.
  await auth.protect();
});

export const config = {
  matcher: [
    // Ignore les internes de Next et les fichiers statiques.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
