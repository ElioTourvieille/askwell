import type { Database } from "@askwell/db";
import { auth } from "@clerk/nextjs/server";
import { fetchWithToken, NeonPostgrestClient } from "@neon/postgrest-js";

/**
 * Client propriétaire : API Data de Neon (`NEXT_PUBLIC_NEON_DATA_API_URL`) avec le jeton de session Clerk
 * de l'utilisateur connecté. La RLS s'applique : il ne voit que ses propres lignes (project.md §7).
 *
 * Le jeton de session Clerk doit contenir `role: authenticated` (à configurer dans Clerk, « Customize session
 * token »). Sans ce claim, l'API Data exécute la requête en `anonymous`, qui n'a accès à rien.
 *
 * Sans session, il n'y a pas de jeton : la requête n'est jamais envoyée (`AuthRequiredError`), elle ne part pas
 * en `anonymous`. Réservé aux lectures du propriétaire et à ses écritures autorisées (renommer, supprimer).
 */
export async function createOwnerClient() {
  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
  if (!dataApiUrl) {
    throw new Error("NEXT_PUBLIC_NEON_DATA_API_URL est absente : le client propriétaire ne peut pas joindre l'API Data de Neon.");
  }

  const { getToken } = await auth();
  return new NeonPostgrestClient<Database>({
    dataApiUrl,
    options: { global: { fetch: fetchWithToken(() => getToken()) } },
  });
}
