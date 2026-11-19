import { PLAN_LIMITS } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNeonPglite, type DbSession, type NeonPglite } from "../neon-pglite.ts";

let sb: NeonPglite;

beforeEach(async () => {
  sb = await createNeonPglite();
});

afterEach(async () => {
  await sb.close();
});

const DENIED = /permission denied/;
const FN = "public.reserve_knowledge_source(uuid, text, text, text, integer)";

async function addProject(userId: string): Promise<string> {
  await sb.asService((tx) => tx.query("insert into public.accounts (clerk_user_id, plan) values ($1, 'free')", [userId]));
  const res = await sb.asService((tx) =>
    tx.query<{ id: string }>("select * from public.create_project($1, $2, $3)", [userId, "P", 100]),
  );
  return res.rows[0]?.id ?? "";
}

/** Insère une source avec un âge donné (en heures). */
async function addSource(projectId: string, status: string, ageHours: number): Promise<void> {
  await sb.asService((tx) =>
    tx.query(
      "insert into public.knowledge_sources (project_id, title, type, status, created_at) values ($1, 'S', 'text', $2, now() - make_interval(hours => $3))",
      [projectId, status, ageHours],
    ),
  );
}

function reserve(tx: DbSession, projectId: string) {
  return tx.query<{ status: string }>("select * from public.reserve_knowledge_source($1, 'Nouvelle', 'text', null, $2)", [
    projectId,
    PLAN_LIMITS.free.maxKnowledgeSources,
  ]);
}

const countSources = async () =>
  (await sb.db.query<{ n: number }>("select count(*)::int as n from public.knowledge_sources")).rows[0]?.n;

describe("reserve_knowledge_source : envois abandonnés", () => {
  it("une uploading de plus de 2 h ne compte plus : la 4e réservation réussit en Gratuit", async () => {
    const projectId = await addProject("user_a");
    await addSource(projectId, "uploading", 3);
    await addSource(projectId, "ready", 5);
    await addSource(projectId, "ready", 1);
    const res = await sb.asService((tx) => reserve(tx, projectId));
    expect(res.rows[0]?.status).toBe("uploading");
    expect(await countSources()).toBe(4);
  });

  it("une uploading récente (moins de 2 h) compte toujours", async () => {
    const projectId = await addProject("user_a");
    await addSource(projectId, "uploading", 1);
    await addSource(projectId, "ready", 5);
    await addSource(projectId, "ready", 1);
    await expect(sb.asService((tx) => reserve(tx, projectId))).rejects.toThrow(/plan_limit_reached/);
  });

  it("seules les uploading périmées sont récupérées : processing, failed et ready anciens comptent", async () => {
    const projectId = await addProject("user_a");
    await addSource(projectId, "processing", 10);
    await addSource(projectId, "failed", 10);
    await addSource(projectId, "ready", 10);
    await expect(sb.asService((tx) => reserve(tx, projectId))).rejects.toThrow(/plan_limit_reached/);
  });

  it("la limite reste respectée sur des réservations concurrentes", async () => {
    const projectId = await addProject("user_a");
    await addSource(projectId, "uploading", 3); // périmée : ne compte pas
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => sb.asService((tx) => reserve(tx, projectId))),
    );
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    const refused = results.filter((r) => r.status === "rejected" && /plan_limit_reached/.test(String(r.reason))).length;
    expect(accepted).toBe(PLAN_LIMITS.free.maxKnowledgeSources);
    expect(refused).toBe(6 - PLAN_LIMITS.free.maxKnowledgeSources);
  });

  it("droits inchangés : seul app_service exécute la fonction", async () => {
    const can = async (role: string) =>
      (await sb.db.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, FN])).rows[0]?.ok;
    expect(await can("app_service")).toBe(true);
    expect(await can("authenticated")).toBe(false);
    expect(await can("anonymous")).toBe(false);
    expect(await can("public")).toBe(false);

    const projectId = await addProject("user_b");
    await expect(sb.asUser("user_b", (tx) => reserve(tx, projectId))).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => reserve(tx, projectId))).rejects.toThrow(DENIED);
  });
});
