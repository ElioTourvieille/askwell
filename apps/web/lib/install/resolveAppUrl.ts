export type AppUrlEnv = {
  NEXT_PUBLIC_APP_URL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  VERCEL_URL?: string | undefined;
};

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Adresse publique de l'application, pour l'extrait d'installation (project.md §6.9, §11).
 *
 * 1. `NEXT_PUBLIC_APP_URL` définie et valide : elle prime (production et local).
 * 2. Sinon, UNIQUEMENT sur un aperçu Vercel (`VERCEL_ENV === "preview"`) : `https://` + `VERCEL_URL`
 *    (`VERCEL_URL` n'a pas de schéma). Exception au §11 décidée par le Product Owner.
 * 3. Sinon `undefined` : la page garde son message d'erreur. En production, on ne devine jamais l'adresse.
 *
 * Fonction pure : l'environnement est passé en argument.
 */
export function resolveAppUrl(env: AppUrlEnv): string | undefined {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && isHttpUrl(configured)) return configured;

  if (env.VERCEL_ENV !== "preview") return undefined;
  const host = env.VERCEL_URL?.trim();
  if (!host) return undefined;
  try {
    const url = new URL(`https://${host}`);
    // Un nom d'hôte seul : ni chemin, ni identifiants, ni paramètres dans une valeur censée être un hôte.
    if (url.host.toLowerCase() !== host.toLowerCase() || url.pathname !== "/" || url.search || url.hash) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}
