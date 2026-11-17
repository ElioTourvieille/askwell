import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@askwell/db";

/**
 * Client Supabase « service » : clé secrète, contourne la RLS. Serveur uniquement.
 * Ce fichier est le seul à lire la clé secrète. Ne l'utiliser pour écrire qu'après
 * `getOwnedProject` (voir lib/auth/get-owned-project.ts), jamais avec un filtre de propriétaire manuel.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL est absente : impossible de créer le client de service.");
  }
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY est absente : impossible de créer le client de service.");
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
