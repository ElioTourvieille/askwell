import { PLAN_LIMITS, type Plan } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; le client de service est remplacé par pglite
// (vraies migrations, rôle `app_service`) : on vérifie le SQL réellement envoyé, sans réseau ni clé.
vi.mock("server-only", () => ({}));
const holder = vi.hoisted(() => ({ db: undefined as { query(text: string, params: unknown[]): Promise<Record<string, unknown>[]> } | undefined }));
vi.mock("../../../../lib/db/service", () => ({
  createServiceClient: () => {
    if (!holder.db) throw new Error("base de test non initialisée");
    return holder.db;
  },
}));

import { consumeMessage, conversationBelongsToProject, findProjectByKey, saveChatTurn } from "./store";

/** Ce que ce test utilise du simulateur pglite de `packages/db`. */
type PgliteTx = { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
type TestDb = {
  asService<T>(fn: (tx: PgliteTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

// Chargé par URL : le simulateur est dans packages/db (imports en `.ts`, non exporté par le paquet).
const PGLITE_URL = new URL("../../../../../../packages/db/neon-pglite.ts", import.meta.url).href;

let sb: TestDb;

beforeEach(async () => {
  const { createNeonPglite } = (await import(/* @vite-ignore */ PGLITE_URL)) as {
    createNeonPglite: () => Promise<TestDb>;
  };
  sb = await createNeonPglite();
  holder.db = { query: async (text, params) => (await sb.asService((tx) => tx.query(text, params))).rows };
});

afterEach(async () => {
  holder.db = undefined;
  await sb.close();
});

const sql = (text: string, params: unknown[] = []) => sb.asService((tx) => tx.query(text, params)).then((r) => r.rows);

async function addProject(userId: string, plan: Plan = "free"): Promise<{ id: string; key: string }> {
  await sql("insert into public.accounts (clerk_user_id, plan) values ($1, $2)", [userId, plan]);
  const [created] = await sql("select * from public.create_project($1, $2, $3)", [userId, `Projet ${userId}`, 100]);
  const [row] = await sql("select id, public_key from public.projects where id = $1", [created?.id]);
  return { id: String(row?.id), key: String(row?.public_key) };
}

async function usedMessages(projectId: string): Promise<number> {
  const [row] = await sql("select messages_used from public.projects where id = $1", [projectId]);
  return Number(row?.messages_used);
}

describe("findProjectByKey", () => {
  it("renvoie l'identifiant du projet et le forfait de son propriétaire", async () => {
    const free = await addProject("user_free", "free");
    const pro = await addProject("user_pro", "pro");

    expect(await findProjectByKey(free.key)).toEqual({ id: free.id, plan: "free" });
    expect(await findProjectByKey(pro.key)).toEqual({ id: pro.id, plan: "pro" });
  });

  it("renvoie null pour une clé inconnue", async () => {
    await addProject("user_free");
    expect(await findProjectByKey("pk_inconnue")).toBeNull();
  });
});

describe("saveChatTurn", () => {
  it("crée la conversation au premier message et enregistre le message du visiteur puis la réponse du bot", async () => {
    const a = await addProject("user_a");
    const id = await saveChatTurn({
      projectId: a.id,
      conversationId: null,
      visitorId: "visiteur-1",
      visitorBody: "Bonjour",
      botBody: "Salut !",
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const messages = await sql("select role, body from public.messages where conversation_id = $1 order by created_at", [id]);
    expect(messages).toEqual([
      { role: "visitor", body: "Bonjour" },
      { role: "bot", body: "Salut !" },
    ]);
    const [conversation] = await sql("select project_id, visitor_id from public.conversations where id = $1", [id]);
    expect(conversation).toEqual({ project_id: a.id, visitor_id: "visiteur-1" });
  });

  it("continue la même conversation avec son identifiant", async () => {
    const a = await addProject("user_a");
    const first = await saveChatTurn({ projectId: a.id, conversationId: null, visitorId: "v", visitorBody: "1", botBody: "r1" });
    const second = await saveChatTurn({ projectId: a.id, conversationId: first, visitorId: "v", visitorBody: "2", botBody: "r2" });

    expect(second).toBe(first);
    const [count] = await sql("select count(*)::int as n from public.messages where conversation_id = $1", [first]);
    expect(count?.n).toBe(4);
  });

  it("refuse la conversation d'un autre projet, sans rien écrire", async () => {
    const a = await addProject("user_a");
    const b = await addProject("user_b");
    const ofA = await saveChatTurn({ projectId: a.id, conversationId: null, visitorId: "v", visitorBody: "1", botBody: "r" });

    await expect(
      saveChatTurn({ projectId: b.id, conversationId: ofA, visitorId: "v", visitorBody: "intrus", botBody: "x" }),
    ).rejects.toThrow(/conversation_not_found/);
    const [count] = await sql("select count(*)::int as n from public.messages");
    expect(count?.n).toBe(2);
  });
});

describe("conversationBelongsToProject", () => {
  it("n'accepte que la conversation du bon projet", async () => {
    const a = await addProject("user_a");
    const b = await addProject("user_b");
    const ofA = await saveChatTurn({ projectId: a.id, conversationId: null, visitorId: "v", visitorBody: "1", botBody: "r" });

    expect(await conversationBelongsToProject(ofA, a.id)).toBe(true);
    expect(await conversationBelongsToProject(ofA, b.id)).toBe(false);
    expect(await conversationBelongsToProject("33333333-3333-4333-8333-333333333333", a.id)).toBe(false);
  });
});

describe("consumeMessage", () => {
  it("compte jusqu'à la limite du forfait, puis refuse sans rien compter de plus", async () => {
    const a = await addProject("user_a");

    expect(await consumeMessage(a.id, 2)).toBe(true);
    expect(await consumeMessage(a.id, 2)).toBe(true);
    expect(await usedMessages(a.id)).toBe(2);

    expect(await consumeMessage(a.id, 2)).toBe(false);
    expect(await usedMessages(a.id)).toBe(2);
  });

  it("applique la limite du forfait Gratuit (100 messages par mois)", async () => {
    const a = await addProject("user_a");
    const limit = PLAN_LIMITS.free.messagesPerMonth;
    await sql("update public.projects set messages_used = $2 where id = $1", [a.id, limit - 1]);

    expect(await consumeMessage(a.id, limit)).toBe(true);
    expect(await consumeMessage(a.id, limit)).toBe(false);
  });

  it("repart à zéro quand le mois a changé", async () => {
    const a = await addProject("user_a");
    await sql("update public.projects set messages_used = 100, period_start = now() - interval '40 days' where id = $1", [a.id]);

    expect(await consumeMessage(a.id, 100)).toBe(true);
    expect(await usedMessages(a.id)).toBe(1);
  });

  it("lève une erreur pour un projet inconnu", async () => {
    await expect(consumeMessage("44444444-4444-4444-8444-444444444444", 100)).rejects.toThrow(/project_not_found/);
  });
});
