import "server-only";
import { PLANS, type Plan } from "@askwell/shared";
import { createServiceClient } from "../db/service";

function isPlan(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

/**
 * Forfait du propriétaire, lu sur le serveur (project.md §9, « Plan bypass »).
 *
 * `accounts` n'a aucune politique RLS pour `authenticated` : le client propriétaire ne peut pas la lire, donc
 * le client de service est utilisé ICI, et seulement pour la colonne `plan`. Les `owner_id` doivent provenir de
 * lignes `projects` DÉJÀ lues avec le client propriétaire (la RLS a prouvé la propriété) : jamais d'un autre endroit.
 * Sans projet, aucune requête n'est faite et le résultat est `null`.
 */
export async function loadOwnerPlan(ownerIds: string[]): Promise<Plan | null> {
  const distinct = [...new Set(ownerIds)];
  if (distinct.length === 0) return null;

  const rows = await createServiceClient().query("select plan from public.accounts where clerk_user_id = any($1)", [
    distinct,
  ]);
  if (rows.length !== 1) throw new Error("Compte introuvable ou ambigu pour le forfait.");
  const plan: unknown = rows[0]?.plan;
  if (!isPlan(plan)) throw new Error("Forfait inconnu dans la table accounts.");
  return plan;
}
