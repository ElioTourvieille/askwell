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

/** Vecteur de 1536 dimensions : `x` et `y` sur les deux premières, zéro ailleurs (norme non nulle si x ou y ≠ 0). */
function vec(x: number, y = 0): string {
  const values = new Array<number>(1536).fill(0);
  values[0] = x;
  values[1] = y;
  return `[${values.join(",")}]`;
}

async function addAccount(userId: string, plan: "free" | "pro" = "free") {
  await sb.asService((tx) => tx.query("insert into public.accounts (clerk_user_id, plan) values ($1, $2)", [userId, plan]));
}

async function addProject(userId: string, name: string): Promise<string> {
  const res = await sb.asService((tx) =>
    tx.query<{ id: string }>("select * from public.create_project($1, $2, $3)", [userId, name, 100]),
  );
  return res.rows[0]?.id ?? "";
}

type SourceRow = { id: string; project_id: string; title: string; type: string; storage_key: string | null; status: string };

function reserve(tx: DbSession, projectId: string, plan: "free" | "pro", title = "Source", type = "text", key: string | null = null) {
  return tx.query<SourceRow>("select * from public.reserve_knowledge_source($1, $2, $3, $4, $5)", [
    projectId,
    title,
    type,
    key,
    PLAN_LIMITS[plan].maxKnowledgeSources,
  ]);
}

async function addSource(projectId: string, status = "ready", title = "Source"): Promise<string> {
  const res = await sb.asService((tx) =>
    tx.query<{ id: string }>(
      "insert into public.knowledge_sources (project_id, title, type, status) values ($1, $2, 'text', $3) returning id",
      [projectId, title, status],
    ),
  );
  return res.rows[0]?.id ?? "";
}

async function addChunk(projectId: string, sourceId: string, content: string, embedding: string): Promise<string> {
  const res = await sb.asService((tx) =>
    tx.query<{ id: string }>(
      "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4::vector) returning id",
      [projectId, sourceId, content, embedding],
    ),
  );
  return res.rows[0]?.id ?? "";
}

function consume(tx: DbSession, projectId: string, plan: "free" | "pro") {
  return tx.query<{ consume_message: boolean }>("select public.consume_message($1, $2)", [
    projectId,
    PLAN_LIMITS[plan].messagesPerMonth,
  ]);
}

function saveTurn(
  tx: DbSession,
  projectId: string,
  conversationId: string | null,
  visitorId = "visiteur_1",
  visitorBody = "Bonjour",
  botBody = "Salut !",
) {
  return tx.query<{ save_chat_turn: string }>("select public.save_chat_turn($1, $2, $3, $4, $5)", [
    projectId,
    conversationId,
    visitorId,
    visitorBody,
    botBody,
  ]);
}

interface Seeded {
  projectA: string;
  projectB: string;
  sourceA: string;
  sourceB: string;
  conversationA: string;
  conversationB: string;
}

/** Deux propriétaires, chacun avec un projet, une source, un segment, une conversation (2 messages). */
async function seedTwoOwners(): Promise<Seeded> {
  await addAccount("user_a");
  await addAccount("user_b");
  const projectA = await addProject("user_a", "Projet A");
  const projectB = await addProject("user_b", "Projet B");
  const sourceA = await addSource(projectA);
  const sourceB = await addSource(projectB);
  await addChunk(projectA, sourceA, "segment A", vec(1));
  await addChunk(projectB, sourceB, "segment B", vec(1));
  const conversationA = (await sb.asService((tx) => saveTurn(tx, projectA, null, "visiteur_a"))).rows[0]?.save_chat_turn ?? "";
  const conversationB = (await sb.asService((tx) => saveTurn(tx, projectB, null, "visiteur_b"))).rows[0]?.save_chat_turn ?? "";
  return { projectA, projectB, sourceA, sourceB, conversationA, conversationB };
}

const NEW_TABLES = ["knowledge_sources", "knowledge_chunks", "conversations", "messages"] as const;

describe("isolation par propriétaire", () => {
  it.each(NEW_TABLES)("un propriétaire ne voit que ses lignes de %s", async (table) => {
    await seedTwoOwners();
    const total = await sb.db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
    const own = await sb.asUser("user_a", (tx) => tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`));
    expect(total.rows[0]?.n).toBeGreaterThan(own.rows[0]?.n ?? 0);
    expect(own.rows[0]?.n).toBeGreaterThan(0);
  });

  it("ne voit que les segments, sources, conversations et messages de son projet", async () => {
    const { projectA, conversationA } = await seedTwoOwners();
    const chunks = await sb.asUser("user_a", (tx) => tx.query<{ content: string }>("select content from public.knowledge_chunks"));
    expect(chunks.rows).toEqual([{ content: "segment A" }]);

    const conversations = await sb.asUser("user_a", (tx) => tx.query<{ id: string; project_id: string }>("select id, project_id from public.conversations"));
    expect(conversations.rows).toEqual([{ id: conversationA, project_id: projectA }]);

    const messages = await sb.asUser("user_a", (tx) => tx.query<{ conversation_id: string }>("select conversation_id from public.messages"));
    expect(messages.rows).toHaveLength(2);
    expect(messages.rows.every((m) => m.conversation_id === conversationA)).toBe(true);
  });

  it("un utilisateur sans projet ne voit rien", async () => {
    await seedTwoOwners();
    for (const table of NEW_TABLES) {
      const rows = await sb.asUser("user_inconnu", (tx) => tx.query(`select * from public.${table}`));
      expect(rows.rows).toHaveLength(0);
    }
  });

  it.each(NEW_TABLES)("un propriétaire ne peut rien écrire dans %s", async (table) => {
    await seedTwoOwners();
    await expect(sb.asUser("user_a", (tx) => tx.query(`insert into public.${table} default values`))).rejects.toThrow(DENIED);
    await expect(sb.asUser("user_a", (tx) => tx.query(`update public.${table} set id = id`))).rejects.toThrow(DENIED);
    await expect(sb.asUser("user_a", (tx) => tx.query(`delete from public.${table}`))).rejects.toThrow(DENIED);
  });

  it("les helpers owned_*_ids ne renvoient que les ids de l'appelant", async () => {
    const { projectA, conversationA } = await seedTwoOwners();
    const projects = await sb.asUser("user_a", (tx) => tx.query<{ owned_project_ids: string }>("select * from public.owned_project_ids()"));
    expect(projects.rows.map((r) => r.owned_project_ids)).toEqual([projectA]);
    const conversations = await sb.asUser("user_a", (tx) =>
      tx.query<{ owned_conversation_ids: string }>("select * from public.owned_conversation_ids()"),
    );
    expect(conversations.rows.map((r) => r.owned_conversation_ids)).toEqual([conversationA]);
  });
});

describe("anonymous", () => {
  it.each(NEW_TABLES)("n'a accès à aucune ligne de %s", async (table) => {
    await seedTwoOwners();
    await expect(sb.asAnonymous((tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => tx.query(`insert into public.${table} default values`))).rejects.toThrow(DENIED);
  });

  it("n'exécute aucune des nouvelles fonctions", async () => {
    const { projectA } = await seedTwoOwners();
    await expect(sb.asAnonymous((tx) => reserve(tx, projectA, "free"))).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => consume(tx, projectA, "free"))).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => saveTurn(tx, projectA, null))).rejects.toThrow(DENIED);
    await expect(
      sb.asAnonymous((tx) => tx.query("select * from public.match_chunks($1, $2::vector)", [projectA, vec(1)])),
    ).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => tx.query("select * from public.owner_activity()"))).rejects.toThrow(DENIED);
    await expect(sb.asAnonymous((tx) => tx.query("select * from public.owned_conversation_ids()"))).rejects.toThrow(DENIED);
  });

  it("un jeton sans role: authenticated tourne en anonymous, même avec un claim sub valide", async () => {
    await seedTwoOwners();
    const claims = { sub: "user_a" };
    for (const table of NEW_TABLES) {
      await expect(sb.asToken(claims, (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(DENIED);
    }
    await expect(sb.asToken(claims, (tx) => tx.query("select * from public.owner_activity()"))).rejects.toThrow(DENIED);
  });
});

describe("TRUNCATE", () => {
  it.each(NEW_TABLES)("est refusé à tous les rôles pour %s", async (table) => {
    await seedTwoOwners();
    await expect(sb.asAnonymous((tx) => tx.query(`truncate public.${table} cascade`))).rejects.toThrow(DENIED);
    await expect(sb.asUser("user_a", (tx) => tx.query(`truncate public.${table} cascade`))).rejects.toThrow(DENIED);
    await expect(sb.asService((tx) => tx.query(`truncate public.${table} cascade`))).rejects.toThrow(DENIED);
  });
});

describe("EXECUTE", () => {
  const can = async (role: string, fn: string) =>
    (await sb.db.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, fn])).rows[0]?.ok;

  it.each([
    "public.reserve_knowledge_source(uuid, text, text, text, integer)",
    "public.consume_message(uuid, integer)",
    "public.save_chat_turn(uuid, uuid, text, text, text)",
    "public.match_chunks(uuid, public.vector, integer)",
  ])("%s : seul app_service l'exécute", async (fn) => {
    expect(await can("app_service", fn)).toBe(true);
    expect(await can("authenticated", fn)).toBe(false);
    expect(await can("anonymous", fn)).toBe(false);
    expect(await can("public", fn)).toBe(false);
  });

  it("owner_activity : authenticated seul", async () => {
    const fn = "public.owner_activity()";
    expect(await can("authenticated", fn)).toBe(true);
    expect(await can("anonymous", fn)).toBe(false);
    expect(await can("public", fn)).toBe(false);
  });

  it("owned_conversation_ids : sans anonymous", async () => {
    const fn = "public.owned_conversation_ids()";
    expect(await can("authenticated", fn)).toBe(true);
    expect(await can("app_service", fn)).toBe(true);
    expect(await can("anonymous", fn)).toBe(false);
  });

  it("authenticated ne peut appeler aucune fonction de limite", async () => {
    const { projectA } = await seedTwoOwners();
    await expect(sb.asUser("user_a", (tx) => reserve(tx, projectA, "free"))).rejects.toThrow(DENIED);
    await expect(sb.asUser("user_a", (tx) => consume(tx, projectA, "free"))).rejects.toThrow(DENIED);
    await expect(sb.asUser("user_a", (tx) => saveTurn(tx, projectA, null))).rejects.toThrow(DENIED);
    await expect(
      sb.asUser("user_a", (tx) => tx.query("select * from public.match_chunks($1, $2::vector)", [projectA, vec(1)])),
    ).rejects.toThrow(DENIED);
  });
});

describe("reserve_knowledge_source", () => {
  it("crée la source en uploading, avec sa clé de stockage", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    const res = await sb.asService((tx) => reserve(tx, projectId, "free", "Guide", "pdf", "projects/p/guide.pdf"));
    expect(res.rows[0]).toMatchObject({
      project_id: projectId,
      title: "Guide",
      type: "pdf",
      storage_key: "projects/p/guide.pdf",
      status: "uploading",
    });
  });

  it("Free : accepte 3 sources (texte collé sans clé de stockage), refuse la 4e", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    for (let i = 1; i <= PLAN_LIMITS.free.maxKnowledgeSources; i++) {
      await sb.asService((tx) => reserve(tx, projectId, "free", `Texte ${i}`));
    }
    await expect(sb.asService((tx) => reserve(tx, projectId, "free", "Texte 4"))).rejects.toThrow(/plan_limit_reached/);
    const count = await sb.db.query<{ n: number }>("select count(*)::int as n from public.knowledge_sources");
    expect(count.rows[0]?.n).toBe(3);
  });

  it("Pro : accepte 25 sources, refuse la 26e", async () => {
    await addAccount("user_p", "pro");
    const projectId = await addProject("user_p", "P");
    for (let i = 1; i <= PLAN_LIMITS.pro.maxKnowledgeSources; i++) {
      await sb.asService((tx) => reserve(tx, projectId, "pro", `Source ${i}`));
    }
    await expect(sb.asService((tx) => reserve(tx, projectId, "pro", "Source 26"))).rejects.toThrow(/plan_limit_reached/);
  });

  it("compte les sources uploading (et toutes les autres) dans la limite", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await sb.asService((tx) => reserve(tx, projectId, "free", "En cours d'envoi")); // uploading
    await addSource(projectId, "failed");
    await addSource(projectId, "ready");
    await expect(sb.asService((tx) => reserve(tx, projectId, "free"))).rejects.toThrow(/plan_limit_reached/);
  });

  it("la limite est propre à chaque projet", async () => {
    const { projectA } = await seedTwoOwners();
    await addAccount("user_c");
    const projectC = await addProject("user_c", "C");
    for (let i = 0; i < 3; i++) await sb.asService((tx) => reserve(tx, projectC, "free"));
    // Le projet C est plein ; le projet A (1 source) peut encore en réserver.
    await expect(sb.asService((tx) => reserve(tx, projectC, "free"))).rejects.toThrow(/plan_limit_reached/);
    await sb.asService((tx) => reserve(tx, projectA, "free"));
  });

  it("refuse un projet inconnu, un type invalide et une limite invalide", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await expect(sb.asService((tx) => reserve(tx, "00000000-0000-0000-0000-000000000000", "free"))).rejects.toThrow(
      /project_not_found/,
    );
    await expect(sb.asService((tx) => reserve(tx, projectId, "free", "X", "exe"))).rejects.toThrow(/check constraint/);
    await expect(
      sb.asService((tx) => tx.query("select * from public.reserve_knowledge_source($1, 'X', 'text', null, null)", [projectId])),
    ).rejects.toThrow(/invalid_limit/);
  });
});

describe("consume_message", () => {
  const messagesUsed = async (projectId: string) =>
    (await sb.db.query<{ messages_used: number }>("select messages_used from public.projects where id = $1", [projectId])).rows[0]
      ?.messages_used;

  it("Free : accepte jusqu'à 100 messages, refuse le 101e", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await sb.db.query("update public.projects set messages_used = 99 where id = $1", [projectId]);

    const hundredth = await sb.asService((tx) => consume(tx, projectId, "free"));
    expect(hundredth.rows[0]?.consume_message).toBe(true);
    expect(await messagesUsed(projectId)).toBe(100);

    const refused = await sb.asService((tx) => consume(tx, projectId, "free"));
    expect(refused.rows[0]?.consume_message).toBe(false);
    expect(await messagesUsed(projectId)).toBe(100);
  });

  it("incrémente de 1 à chaque message accepté", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    for (let i = 1; i <= 5; i++) {
      const res = await sb.asService((tx) => consume(tx, projectId, "free"));
      expect(res.rows[0]?.consume_message).toBe(true);
    }
    expect(await messagesUsed(projectId)).toBe(5);
  });

  it("Pro : la limite passée en paramètre est 2 000", async () => {
    await addAccount("user_p", "pro");
    const projectId = await addProject("user_p", "P");
    await sb.db.query("update public.projects set messages_used = 1999 where id = $1", [projectId]);
    expect((await sb.asService((tx) => consume(tx, projectId, "pro"))).rows[0]?.consume_message).toBe(true);
    expect((await sb.asService((tx) => consume(tx, projectId, "pro"))).rows[0]?.consume_message).toBe(false);
  });

  it("remet le compteur à zéro quand period_start est d'un mois précédent", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await sb.db.query(
      "update public.projects set messages_used = 100, period_start = date_trunc('month', now()) - interval '1 month' where id = $1",
      [projectId],
    );

    const res = await sb.asService((tx) => consume(tx, projectId, "free"));
    expect(res.rows[0]?.consume_message).toBe(true);

    const row = await sb.db.query<{ messages_used: number; current_month: boolean }>(
      "select messages_used, period_start = date_trunc('month', now()) as current_month from public.projects where id = $1",
      [projectId],
    );
    expect(row.rows[0]).toEqual({ messages_used: 1, current_month: true });
  });

  it("le compteur est propre à chaque projet", async () => {
    const { projectA, projectB } = await seedTwoOwners();
    await sb.db.query("update public.projects set messages_used = 100 where id = $1", [projectA]);
    expect((await sb.asService((tx) => consume(tx, projectA, "free"))).rows[0]?.consume_message).toBe(false);
    expect((await sb.asService((tx) => consume(tx, projectB, "free"))).rows[0]?.consume_message).toBe(true);
  });

  it("refuse un projet inconnu et une limite invalide", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await expect(sb.asService((tx) => consume(tx, "00000000-0000-0000-0000-000000000000", "free"))).rejects.toThrow(
      /project_not_found/,
    );
    await expect(
      sb.asService((tx) => tx.query("select public.consume_message($1, null)", [projectId])),
    ).rejects.toThrow(/invalid_limit/);
  });
});

describe("save_chat_turn", () => {
  it("crée la conversation au premier message, avec les deux messages dans l'ordre", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    const res = await sb.asService((tx) => saveTurn(tx, projectId, null, "visiteur_1", "Quels horaires ?", "De 9 h à 18 h."));
    const conversationId = res.rows[0]?.save_chat_turn;

    const conversation = await sb.db.query<{ project_id: string; visitor_id: string }>(
      "select project_id, visitor_id from public.conversations where id = $1",
      [conversationId],
    );
    expect(conversation.rows).toEqual([{ project_id: projectId, visitor_id: "visiteur_1" }]);

    const messages = await sb.db.query<{ role: string; body: string }>(
      "select role, body from public.messages where conversation_id = $1 order by created_at",
      [conversationId],
    );
    expect(messages.rows).toEqual([
      { role: "visitor", body: "Quels horaires ?" },
      { role: "bot", body: "De 9 h à 18 h." },
    ]);
  });

  it("continue une conversation existante du même projet", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    const first = await sb.asService((tx) => saveTurn(tx, projectId, null));
    const conversationId = first.rows[0]?.save_chat_turn ?? "";
    const second = await sb.asService((tx) => saveTurn(tx, projectId, conversationId, "visiteur_1", "Merci", "Avec plaisir"));
    expect(second.rows[0]?.save_chat_turn).toBe(conversationId);

    const counts = await sb.db.query<{ conversations: number; messages: number }>(
      "select (select count(*) from public.conversations)::int as conversations, (select count(*) from public.messages)::int as messages",
    );
    expect(counts.rows[0]).toEqual({ conversations: 1, messages: 4 });

    const bodies = await sb.db.query<{ body: string }>("select body from public.messages order by created_at");
    expect(bodies.rows.map((r) => r.body)).toEqual(["Bonjour", "Salut !", "Merci", "Avec plaisir"]);
  });

  it("refuse la conversation d'un autre projet, sans rien écrire", async () => {
    const { projectA, conversationB } = await seedTwoOwners();
    const before = await sb.db.query<{ n: number }>("select count(*)::int as n from public.messages");

    await expect(sb.asService((tx) => saveTurn(tx, projectA, conversationB))).rejects.toThrow(/conversation_not_found/);

    const after = await sb.db.query<{ n: number }>("select count(*)::int as n from public.messages");
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });

  it("refuse une conversation inconnue", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await expect(
      sb.asService((tx) => saveTurn(tx, projectId, "00000000-0000-0000-0000-000000000000")),
    ).rejects.toThrow(/conversation_not_found/);
  });
});

describe("match_chunks", () => {
  const match = (projectId: string, embedding: string, limit?: number) =>
    sb.asService((tx) =>
      limit === undefined
        ? tx.query<{ content: string; similarity: number }>("select * from public.match_chunks($1, $2::vector)", [projectId, embedding])
        : tx.query<{ content: string; similarity: number }>("select * from public.match_chunks($1, $2::vector, $3)", [
            projectId,
            embedding,
            limit,
          ]),
    );

  it("classe par similarité cosinus décroissante", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    const source = await addSource(projectId);
    await addChunk(projectId, source, "loin", vec(0, 1));
    await addChunk(projectId, source, "proche", vec(1, 0.1));
    await addChunk(projectId, source, "identique", vec(1, 0));

    const res = await match(projectId, vec(1, 0));
    expect(res.rows.map((r) => r.content)).toEqual(["identique", "proche", "loin"]);
    expect(res.rows[0]?.similarity).toBeCloseTo(1, 5);
    expect(res.rows[2]?.similarity).toBeCloseTo(0, 5);
  });

  it("ne renvoie jamais un segment d'un autre projet", async () => {
    const { projectA, projectB } = await seedTwoOwners();
    const resA = await match(projectA, vec(1));
    expect(resA.rows.map((r) => r.content)).toEqual(["segment A"]);
    const resB = await match(projectB, vec(1));
    expect(resB.rows.map((r) => r.content)).toEqual(["segment B"]);
  });

  it("ne renvoie que les segments dont la source est ready", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    for (const status of ["uploading", "processing", "failed"]) {
      await addChunk(projectId, await addSource(projectId, status, status), `segment ${status}`, vec(1));
    }
    expect((await match(projectId, vec(1))).rows).toHaveLength(0);

    await addChunk(projectId, await addSource(projectId, "ready"), "segment ready", vec(1));
    expect((await match(projectId, vec(1))).rows.map((r) => r.content)).toEqual(["segment ready"]);
  });

  it("renvoie 5 segments par défaut, ou le nombre demandé", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    const source = await addSource(projectId);
    for (let i = 1; i <= 8; i++) await addChunk(projectId, source, `segment ${i}`, vec(1, i / 10));

    expect((await match(projectId, vec(1))).rows).toHaveLength(5);
    expect((await match(projectId, vec(1), 2)).rows.map((r) => r.content)).toEqual(["segment 1", "segment 2"]);
    expect((await match(projectId, vec(1), 20)).rows).toHaveLength(8);
  });

  it("refuse une limite invalide", async () => {
    await addAccount("user_a");
    const projectId = await addProject("user_a", "P");
    await expect(match(projectId, vec(1), 0)).rejects.toThrow(/invalid_limit/);
    await expect(
      sb.asService((tx) => tx.query("select * from public.match_chunks($1, $2::vector, null)", [projectId, vec(1)])),
    ).rejects.toThrow(/invalid_limit/);
  });
});

describe("cascades et intégrité", () => {
  it("supprimer une source supprime ses segments, et seulement les siens", async () => {
    const { projectA, sourceA } = await seedTwoOwners();
    const otherSource = await addSource(projectA, "ready", "Autre");
    await addChunk(projectA, otherSource, "segment autre", vec(0, 1));

    await sb.asService((tx) => tx.query("delete from public.knowledge_sources where id = $1", [sourceA]));

    const left = await sb.db.query<{ content: string }>(
      "select content from public.knowledge_chunks where project_id = $1",
      [projectA],
    );
    expect(left.rows).toEqual([{ content: "segment autre" }]);
    const all = await sb.db.query<{ n: number }>("select count(*)::int as n from public.knowledge_chunks");
    expect(all.rows[0]?.n).toBe(2); // segment autre + segment B
  });

  it("supprimer un projet supprime ses sources, segments, conversations et messages", async () => {
    await seedTwoOwners();
    await sb.asUser("user_a", (tx) => tx.query("delete from public.projects"));

    for (const table of NEW_TABLES) {
      const rows = await sb.db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
      // Il reste exactement ce qui appartient à user_b (1 source, 1 segment, 1 conversation, 2 messages).
      expect(rows.rows[0]?.n).toBe(table === "messages" ? 2 : 1);
    }
  });

  it("un segment ne peut pas désigner une source d'un autre projet", async () => {
    const { projectA, sourceB } = await seedTwoOwners();
    await expect(addChunk(projectA, sourceB, "intrus", vec(1))).rejects.toThrow(/foreign key/);
  });

  it("refuse une dimension d'embedding différente de 1536", async () => {
    const { projectA, sourceA } = await seedTwoOwners();
    await expect(addChunk(projectA, sourceA, "court", "[1,2,3]")).rejects.toThrow(/dimensions/);
  });

  it("l'index HNSW sur embedding utilise la distance cosinus", async () => {
    const idx = await sb.db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'knowledge_chunks'",
    );
    expect(idx.rows.some((r) => /USING hnsw \(embedding (public\.)?vector_cosine_ops\)/.test(r.indexdef))).toBe(true);
  });
});

describe("owner_activity", () => {
  it("renvoie, par projet possédé, le quota, la période et les nombres de conversations et de sources", async () => {
    const { projectA } = await seedTwoOwners();
    await addSource(projectA, "processing", "Deuxième");
    await sb.asService((tx) => saveTurn(tx, projectA, null, "visiteur_2"));
    await sb.asService((tx) => consume(tx, projectA, "free"));
    await sb.asService((tx) => consume(tx, projectA, "free"));

    const res = await sb.asUser("user_a", (tx) =>
      tx.query<{
        project_id: string;
        messages_used: number;
        period_start: string | Date;
        conversation_count: number | bigint;
        source_count: number | bigint;
      }>("select * from public.owner_activity()"),
    );
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row?.project_id).toBe(projectA);
    expect(row?.messages_used).toBe(2);
    expect(row?.period_start).toBeDefined();
    expect(Number(row?.conversation_count)).toBe(2);
    expect(Number(row?.source_count)).toBe(2);
  });

  it("ne montre que les projets de l'appelant", async () => {
    const { projectA, projectB } = await seedTwoOwners();
    const asA = await sb.asUser("user_a", (tx) => tx.query<{ project_id: string }>("select project_id from public.owner_activity()"));
    expect(asA.rows.map((r) => r.project_id)).toEqual([projectA]);
    const asB = await sb.asUser("user_b", (tx) => tx.query<{ project_id: string }>("select project_id from public.owner_activity()"));
    expect(asB.rows.map((r) => r.project_id)).toEqual([projectB]);
    const asNobody = await sb.asUser("user_inconnu", (tx) => tx.query("select * from public.owner_activity()"));
    expect(asNobody.rows).toHaveLength(0);
  });

  it("tourne avec les droits de l'appelant (SECURITY INVOKER)", async () => {
    const fn = await sb.db.query<{ prosecdef: boolean }>("select prosecdef from pg_proc where proname = 'owner_activity'");
    expect(fn.rows[0]?.prosecdef).toBe(false);
  });
});

describe("app_service : privilèges minimaux", () => {
  const priv = async (table: string, privilege: string) =>
    (
      await sb.db.query<{ ok: boolean }>("select has_table_privilege('app_service', $1, $2) as ok", [
        `public.${table}`,
        privilege,
      ])
    ).rows[0]?.ok;

  it("n'a que ce que la migration lui accorde", async () => {
    expect(await priv("knowledge_sources", "UPDATE")).toBe(true);
    expect(await priv("knowledge_chunks", "INSERT")).toBe(true);
    expect(await priv("knowledge_chunks", "UPDATE")).toBe(false);
    expect(await priv("conversations", "INSERT")).toBe(true);
    expect(await priv("conversations", "UPDATE")).toBe(false);
    expect(await priv("conversations", "DELETE")).toBe(false);
    expect(await priv("messages", "INSERT")).toBe(true);
    expect(await priv("messages", "UPDATE")).toBe(false);
    expect(await priv("messages", "DELETE")).toBe(false);
    for (const table of NEW_TABLES) expect(await priv(table, "TRUNCATE")).toBe(false);
  });
});

describe("règles de sécurité de la base (§9), schéma complet", () => {
  it("chaque table de public a la RLS activée", async () => {
    const tables = await sb.db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(tables.rows.map((t) => t.relname).sort()).toEqual([
      "accounts",
      "conversations",
      "knowledge_chunks",
      "knowledge_sources",
      "messages",
      "projects",
      "schema_migrations",
      "widget_configs",
    ]);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
  });

  it("chaque fonction de la migration a search_path vide ; seuls les deux helpers sont SECURITY DEFINER", async () => {
    // Hors fonctions de l'extension pgvector (installées dans public par `create extension`).
    const fns = await sb.db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`,
    );
    expect(fns.rows.map((f) => f.proname).sort()).toEqual([
      "consume_message",
      "create_project",
      "match_chunks",
      "owned_conversation_ids",
      "owned_project_ids",
      "owner_activity",
      "reserve_knowledge_source",
      "save_chat_turn",
    ]);
    for (const fn of fns.rows) {
      expect(fn.proconfig).toContain('search_path=""');
    }
    expect(fns.rows.filter((f) => f.prosecdef).map((f) => f.proname).sort()).toEqual([
      "owned_conversation_ids",
      "owned_project_ids",
    ]);
  });

  it("enregistre les deux migrations, dans l'ordre", async () => {
    const versions = await sb.db.query<{ version: string }>("select version from public.schema_migrations order by version");
    expect(versions.rows.map((r) => r.version)).toEqual(["20261117150000", "20261117160000"]);
  });
});
