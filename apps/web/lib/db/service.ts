import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Client de service : connexion Postgres directe (`DATABASE_URL`), rôle `app_service`.
 *
 * ATTENTION : `app_service` contourne la RLS (project.md §7 et §9).
 * - Serveur uniquement (`import "server-only"` ci-dessus). Ce fichier est le SEUL à lire `DATABASE_URL`.
 * - À utiliser pour les routes visiteur, le webhook Clerk, le traitement des connaissances et les écritures
 *   que le propriétaire ne peut pas faire, JAMAIS avec un filtre de propriétaire écrit à la main.
 * - Une écriture pour le compte d'un propriétaire n'est permise qu'après un `getOwnedProject` réussi
 *   (`lib/auth/get-owned-project.ts`), et après lecture du forfait sur le serveur.
 * - Les limites passent par les fonctions SQL (`create_project`, `reserve_knowledge_source`, `consume_message`,
 *   `save_chat_turn`, `match_chunks`), par exemple :
 *   `await sql.query("select * from public.consume_message($1, $2)", [projectId, limit])`.
 *
 * Retourne la fonction `sql` de `@neondatabase/serverless` (HTTP, une requête par appel ; `sql.transaction([...])`
 * pour grouper). Aucune connexion n'est ouverte avant la première requête.
 */
export function createServiceClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Message sans valeur : jamais l'URL de connexion dans une erreur ou un journal.
    throw new Error(
      "DATABASE_URL est absente : le client de service ne peut pas se connecter (connexion du rôle app_service au projet Neon, voir project.md §11).",
    );
  }
  return neon(url);
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
