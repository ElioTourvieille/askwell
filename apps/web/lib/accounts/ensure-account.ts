import "server-only";
import { createServiceClient } from "../db/service";

/**
 * Crée la ligne `accounts` d'un utilisateur Clerk à sa première arrivée sur le tableau de bord.
 *
 * - Idempotent : `on conflict do nothing`, un utilisateur qui revient ne crée pas de doublon.
 * - Le forfait est TOUJOURS `free` à la création, écrit en dur ici (project.md §9) : jamais lu depuis le client.
 * - `clerkUserId` doit venir de la session Clerk côté serveur (`auth()`), jamais d'un paramètre de requête.
 * - Une erreur de base est propagée telle quelle : le tableau de bord affiche alors `error.tsx`.
 */
export async function ensureAccount(clerkUserId: string): Promise<void> {
  const sql = createServiceClient();
  await sql.query(
    "insert into public.accounts (clerk_user_id, plan) values ($1, 'free') on conflict (clerk_user_id) do nothing",
    [clerkUserId],
  );
}
