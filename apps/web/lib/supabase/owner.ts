import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@askwell/db";

/**
 * Client Supabase du propriétaire connecté : il envoie son jeton de session Clerk, donc la RLS
 * s'applique (project.md §7). À utiliser pour toute lecture faite pour le compte du propriétaire.
 */
export function createOwnerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY doivent être définies.");
  }

  return createClient<Database>(url, publishableKey, {
    accessToken: async () => (await auth()).getToken(),
  });
}
