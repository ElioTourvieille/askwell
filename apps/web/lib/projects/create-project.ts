import "server-only";
import type { Tables } from "@askwell/db";
import { PLAN_LIMITS, PLANS, type Plan } from "@askwell/shared";
import { createServiceClient } from "../db/service";

export type CreateProjectFailure = "account_not_found" | "plan_limit_reached";

export type CreateProjectResult =
  | { ok: true; project: Tables<"projects"> }
  | { ok: false; reason: CreateProjectFailure };

/**
 * Classe une erreur de `create_project` (migration 1) : `account_not_found` (P0002) et `plan_limit_reached`
 * (P0001) sont des cas prévus ; toute autre erreur est inattendue (`null`) et doit remonter.
 */
export function classifyCreateProjectError(error: unknown): CreateProjectFailure | null {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("plan_limit_reached")) return "plan_limit_reached";
  if (message.includes("account_not_found")) return "account_not_found";
  return null;
}

function isPlan(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

/**
 * Crée un projet pour `ownerId` (identifiant Clerk de la SESSION, jamais celui de la requête).
 * Le forfait est lu ici, sur le serveur (project.md §9, « Plan bypass ») ; la limite vient de `PLAN_LIMITS`
 * et `create_project` la vérifie de façon atomique.
 */
export async function createProject(ownerId: string, name: string): Promise<CreateProjectResult> {
  const sql = createServiceClient();

  const accounts = await sql.query("select plan from public.accounts where clerk_user_id = $1", [ownerId]);
  const plan: unknown = accounts[0]?.plan;
  if (plan === undefined) return { ok: false, reason: "account_not_found" };
  if (!isPlan(plan)) throw new Error("Forfait inconnu dans la table accounts.");

  try {
    const rows = await sql.query("select * from public.create_project($1, $2, $3)", [
      ownerId,
      name,
      PLAN_LIMITS[plan].maxProjects,
    ]);
    return { ok: true, project: rows[0] as Tables<"projects"> };
  } catch (error) {
    const reason = classifyCreateProjectError(error);
    if (reason) return { ok: false, reason };
    throw error;
  }
}
