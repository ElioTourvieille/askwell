import { CHAT_RETRIEVAL_CHUNKS } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; `../openai` et `../db/service` sont remplacés
// (vecteurs fixes, base pglite) : aucun appel réseau, aucune clé.
vi.mock("server-only", () => ({}));
vi.mock("../openai", () => ({ embedTexts: vi.fn() }));
vi.mock("../db/service", () => ({ createServiceClient: vi.fn() }));

import { retrieveChunks, type ChunkQueryRunner } from "./retrieve";

/** Ce que ce test utilise du simulateur pglite de `packages/db` (rôle `app_service`, vraies migrations). */
type PgliteTx = { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
type TestDb = {
  asService<T>(fn: (tx: PgliteTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

// Chargé par URL : le simulateur est dans packages/db (imports en `.ts`, non exporté par le paquet).
// Un import statique ferait parcourir ces fichiers par `tsc` d'apps/web.
const PGLITE_URL = new URL("../../../../packages/db/neon-pglite.ts", import.meta.url).href;

let sb: TestDb;

beforeEach(async () => {
  const { createNeonPglite } = (await import(/* @vite-ignore */ PGLITE_URL)) as {
    createNeonPglite: () => Promise<TestDb>;
  };
  sb = await createNeonPglite();
});

afterEach(async () => {
  await sb.close();
});

/** Vecteur de 1 536 dimensions : `x` et `y` sur les deux premières, zéro ailleurs. */
function vec(x: number, y = 0): number[] {
  const values = new Array<number>(1536).fill(0);
  values[0] = x;
  values[1] = y;
  return values;
}

const literal = (v: number[]) => `[${v.join(",")}]`;

/** Exécuteur de requêtes branché sur pglite, avec la même forme que `sql.query` de Neon (tableau de lignes). */
const db: ChunkQueryRunner = {
  query: async (text, params) => (await sb.asService((tx) => tx.query(text, params))).rows,
};

async function addProject(userId: string, name: string): Promise<string> {
  await sb.asService((tx) => tx.query("insert into public.accounts (clerk_user_id, plan) values ($1, 'free')", [userId]));
  const res = await sb.asService((tx) => tx.query("select * from public.create_project($1, $2, $3)", [userId, name, 100]));
  return String(res.rows[0]?.id);
}

async function addSource(projectId: string, status: string, title = "Source"): Promise<string> {
  const res = await sb.asService((tx) =>
    tx.query(
      "insert into public.knowledge_sources (project_id, title, type, status) values ($1, $2, 'text', $3) returning id",
      [projectId, title, status],
    ),
  );
  return String(res.rows[0]?.id);
}

async function addChunk(projectId: string, sourceId: string, content: string, embedding: number[]): Promise<void> {
  await sb.asService((tx) =>
    tx.query(
      "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4::vector)",
      [projectId, sourceId, content, literal(embedding)],
    ),
  );
}

/** Embedding simulé : la question a toujours le vecteur fixe (1, 0). */
const embed = vi.fn(async (texts: string[]) => texts.map(() => vec(1, 0)));

beforeEach(() => {
  embed.mockClear();
});

describe("retrieveChunks (pglite, segments pré-définis)", () => {
  it("ne renvoie que les segments du projet demandé (deux projets, mêmes vecteurs)", async () => {
    const a = await addProject("user_a", "Projet A");
    const b = await addProject("user_b", "Projet B");
    await addChunk(a, await addSource(a, "ready"), "secret du projet A", vec(1, 0));
    await addChunk(b, await addSource(b, "ready"), "secret du projet B", vec(1, 0));

    const fromA = await retrieveChunks(a, "question", { embed, db });
    expect(fromA.map((c) => c.content)).toEqual(["secret du projet A"]);

    const fromB = await retrieveChunks(b, "question", { embed, db });
    expect(fromB.map((c) => c.content)).toEqual(["secret du projet B"]);
  });

  it("ne renvoie que les sources `ready` (pas uploading, processing ni failed)", async () => {
    const a = await addProject("user_a", "Projet A");
    await addChunk(a, await addSource(a, "ready", "prête"), "texte prêt", vec(1, 0));
    await addChunk(a, await addSource(a, "processing", "en cours"), "texte en cours", vec(1, 0));
    await addChunk(a, await addSource(a, "uploading", "envoi"), "texte en envoi", vec(1, 0));
    await addChunk(a, await addSource(a, "failed", "échec"), "texte en échec", vec(1, 0));

    const chunks = await retrieveChunks(a, "question", { embed, db });
    expect(chunks.map((c) => c.content)).toEqual(["texte prêt"]);
  });

  it("renvoie au plus 5 segments, du plus proche au moins proche", async () => {
    const a = await addProject("user_a", "Projet A");
    const source = await addSource(a, "ready");
    // y croissant = de plus en plus éloigné du vecteur de la question (1, 0).
    for (let i = 0; i < 7; i++) await addChunk(a, source, `segment ${i}`, vec(1, i * 0.5));

    const chunks = await retrieveChunks(a, "question", { embed, db });
    expect(CHAT_RETRIEVAL_CHUNKS).toBe(5);
    expect(chunks.map((c) => c.content)).toEqual(["segment 0", "segment 1", "segment 2", "segment 3", "segment 4"]);
    const similarities = chunks.map((c) => c.similarity);
    expect(similarities).toEqual([...similarities].sort((x, y) => y - x));
    expect(similarities[0]).toBeCloseTo(1, 5);
  });

  it("renvoie les identifiants et la similarité sous forme de texte et de nombre", async () => {
    const a = await addProject("user_a", "Projet A");
    const source = await addSource(a, "ready");
    await addChunk(a, source, "contenu", vec(1, 0));

    const [chunk] = await retrieveChunks(a, "question", { embed, db });
    expect(chunk?.sourceId).toBe(source);
    expect(typeof chunk?.id).toBe("string");
    expect(typeof chunk?.similarity).toBe("number");
  });

  it("renvoie une liste vide pour un projet sans segment ou inconnu", async () => {
    const a = await addProject("user_a", "Projet A");
    expect(await retrieveChunks(a, "question", { embed, db })).toEqual([]);
    expect(await retrieveChunks("00000000-0000-0000-0000-000000000000", "question", { embed, db })).toEqual([]);
  });

  it("calcule l'embedding de la question, une seule fois", async () => {
    const a = await addProject("user_a", "Projet A");
    await retrieveChunks(a, "Quels sont vos horaires ?", { embed, db });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(["Quels sont vos horaires ?"]);
  });
});

describe("retrieveChunks (garde-fous)", () => {
  it("ne calcule rien et n'interroge pas la base pour une question vide", async () => {
    const query = vi.fn();
    expect(await retrieveChunks("p", "   ", { embed, db: { query } })).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("passe le projet et la limite de 5 à match_chunks, avec le vecteur en littéral pgvector", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await retrieveChunks("projet-1", "question", { embed, db: { query } });
    expect(query).toHaveBeenCalledTimes(1);
    const [text, params] = query.mock.calls[0] as [string, unknown[]];
    expect(text).toContain("public.match_chunks($1, $2::vector, $3)");
    expect(params[0]).toBe("projet-1");
    expect(String(params[1]).startsWith("[1,0,0")).toBe(true);
    expect(params[2]).toBe(CHAT_RETRIEVAL_CHUNKS);
  });

  it("lève une erreur si l'embedding ne renvoie aucun vecteur", async () => {
    const empty = vi.fn().mockResolvedValue([]);
    await expect(retrieveChunks("p", "question", { embed: empty, db: { query: vi.fn() } })).rejects.toThrow(
      /Aucun vecteur/,
    );
  });
});
