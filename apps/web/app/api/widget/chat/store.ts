import "server-only";
import { PLANS, type Plan } from "@askwell/shared";
import { createServiceClient } from "../../../../lib/db/service";

/**
 * Accès base de la route de chat (project.md §6.6, §7). Client de service : c'est un visiteur sans compte,
 * la clé publique est le seul point d'entrée et la route a déjà résolu le projet avant toute écriture.
 * Les limites passent par les fonctions SQL (`consume_message`, `save_chat_turn`), jamais par du SQL libre.
 */

export type ChatProject = { id: string; plan: Plan };

function isPlan(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

/** Projet et forfait du propriétaire, lus sur le serveur à partir de la clé publique. `null` si inconnue. */
export async function findProjectByKey(publicKey: string): Promise<ChatProject | null> {
  const rows = await createServiceClient().query(
    `select p.id, a.plan
       from public.projects p
       join public.accounts a on a.clerk_user_id = p.owner_id
      where p.public_key = $1`,
    [publicKey],
  );
  const row = rows[0];
  if (!row) return null;
  if (!isPlan(row.plan)) throw new Error("Forfait inconnu dans la table accounts.");
  return { id: String(row.id), plan: row.plan };
}

/** La conversation existe-t-elle ET appartient-elle à ce projet ? (Vérifié avant de compter le message.) */
export async function conversationBelongsToProject(conversationId: string, projectId: string): Promise<boolean> {
  const rows = await createServiceClient().query(
    "select 1 as found from public.conversations where id = $1::uuid and project_id = $2::uuid",
    [conversationId, projectId],
  );
  return rows.length > 0;
}

/**
 * Compte un message pour ce projet, en une seule instruction sous verrou de ligne : `false` si la limite
 * mensuelle du forfait est atteinte (rien n'est compté dans ce cas).
 */
export async function consumeMessage(projectId: string, maxMessages: number): Promise<boolean> {
  const rows = await createServiceClient().query("select public.consume_message($1::uuid, $2::integer) as allowed", [
    projectId,
    maxMessages,
  ]);
  return rows[0]?.allowed === true;
}

export type ChatTurn = {
  projectId: string;
  /** `null` au premier message : la conversation est alors créée. */
  conversationId: string | null;
  visitorId: string;
  visitorBody: string;
  botBody: string;
};

/** Enregistre le message du visiteur et la réponse du bot, et renvoie l'identifiant de la conversation. */
export async function saveChatTurn(turn: ChatTurn): Promise<string> {
  const rows = await createServiceClient().query(
    "select public.save_chat_turn($1::uuid, $2::uuid, $3, $4, $5) as conversation_id",
    [turn.projectId, turn.conversationId, turn.visitorId, turn.visitorBody, turn.botBody],
  );
  const id = rows[0]?.conversation_id;
  if (typeof id !== "string") throw new Error("save_chat_turn n'a pas renvoyé de conversation.");
  return id;
}
