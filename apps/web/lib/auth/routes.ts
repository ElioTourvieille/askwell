/**
 * Routes du propriétaire (docs/project.md §8) : session Clerk obligatoire.
 * Fonction pure, sans dépendance, pour pouvoir être testée seule.
 * Tout le reste (/, /sign-in, /sign-up, /embed, /api/widget, /api/clerk/webhook,
 * /api/posthog-config) est public.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/api/projects", "/api/knowledge", "/api/conversations"];

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => hasPrefix(pathname, prefix));
}

/** Les routes d'API répondent 401 en JSON ; les pages redirigent vers la connexion. */
export function isApiRoute(pathname: string): boolean {
  return hasPrefix(pathname, "/api");
}
