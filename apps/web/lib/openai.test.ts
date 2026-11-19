import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; ici on ne teste que la logique.
vi.mock("server-only", () => ({}));

const { embeddingsCreate, chatCreate, OpenAIMock } = vi.hoisted(() => {
  const embeddingsCreate = vi.fn();
  const chatCreate = vi.fn();
  const OpenAIMock = vi.fn(function (this: unknown) {
    Object.assign(this as object, {
      embeddings: { create: embeddingsCreate },
      chat: { completions: { create: chatCreate } },
    });
  });
  return { embeddingsCreate, chatCreate, OpenAIMock };
});
vi.mock("openai", () => ({ default: OpenAIMock }));

const vector = () => Array.from({ length: 1536 }, (_, i) => i / 1536);

// Simule l'API : un vecteur de 1 536 valeurs par texte reçu.
function fakeEmbeddings({ input }: { input: string[] }) {
  return Promise.resolve({ data: input.map((_, index) => ({ index, embedding: vector() })) });
}

async function loadModule() {
  vi.resetModules();
  return import("./openai");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "cle-de-test");
  embeddingsCreate.mockImplementation(fakeEmbeddings);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("client OpenAI", () => {
  it("n'est pas créé à l'import", async () => {
    await loadModule();
    expect(OpenAIMock).not.toHaveBeenCalled();
  });

  it("est créé à la première utilisation puis réutilisé", async () => {
    const { embedTexts, getOpenAI } = await loadModule();
    await embedTexts(["a"]);
    await embedTexts(["b"]);
    expect(getOpenAI()).toBe(getOpenAI());
    expect(OpenAIMock).toHaveBeenCalledTimes(1);
    expect(OpenAIMock).toHaveBeenCalledWith({ apiKey: "cle-de-test" });
  });

  it("lève une erreur claire, sans la clé, si OPENAI_API_KEY est absente", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { embedTexts, createChatCompletion } = await loadModule();
    await expect(embedTexts(["a"])).rejects.toThrow(/OPENAI_API_KEY est absente/);
    await expect(createChatCompletion({ messages: [] })).rejects.toThrow(/OPENAI_API_KEY est absente/);
    expect(OpenAIMock).not.toHaveBeenCalled();
  });
});

describe("embedTexts", () => {
  it("renvoie un vecteur de 1536 dimensions par texte avec le modèle imposé", async () => {
    const { embedTexts, EMBEDDING_MODEL } = await loadModule();
    const result = await embedTexts(["bonjour", "au revoir"]);
    expect(result).toHaveLength(2);
    for (const v of result) expect(v).toHaveLength(1536);
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(embeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["bonjour", "au revoir"],
    });
  });

  it("ne fait aucun appel pour une liste vide", async () => {
    const { embedTexts } = await loadModule();
    expect(await embedTexts([])).toEqual([]);
    expect(OpenAIMock).not.toHaveBeenCalled();
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  it("découpe en lots de 100 et garde l'ordre d'entrée", async () => {
    const { embedTexts } = await loadModule();
    const texts = Array.from({ length: 250 }, (_, i) => `texte ${i}`);
    // Chaque vecteur commence par le numéro du texte pour vérifier l'ordre ; l'API répond à l'envers.
    embeddingsCreate.mockImplementation(({ input }: { input: string[] }) =>
      Promise.resolve({
        data: input
          .map((text, index) => ({
            index,
            embedding: [Number(text.split(" ")[1]), ...Array<number>(1535).fill(0)],
          }))
          .reverse(),
      }),
    );
    const result = await embedTexts(texts);
    expect(embeddingsCreate).toHaveBeenCalledTimes(3);
    expect(embeddingsCreate.mock.calls.map(([arg]) => arg.input.length)).toEqual([100, 100, 50]);
    expect(result).toHaveLength(250);
    expect(result.map((v) => v[0])).toEqual(texts.map((_, i) => i));
  });

  it("échoue si l'API renvoie un nombre de vecteurs différent", async () => {
    const { embedTexts } = await loadModule();
    embeddingsCreate.mockResolvedValue({ data: [] });
    await expect(embedTexts(["a"])).rejects.toThrow(/0 vecteur\(s\) pour 1 texte\(s\)/);
  });
});

describe("createChatCompletion", () => {
  it("appelle le modèle de chat et renvoie le texte", async () => {
    const { createChatCompletion, CHAT_MODEL } = await loadModule();
    chatCreate.mockResolvedValue({ choices: [{ message: { content: "Salut !" } }] });
    const messages = [{ role: "user" as const, content: "Bonjour" }];
    expect(await createChatCompletion({ messages, maxCompletionTokens: 200 })).toBe("Salut !");
    expect(chatCreate).toHaveBeenCalledWith({
      model: CHAT_MODEL,
      messages,
      max_completion_tokens: 200,
    });
  });

  it("renvoie une chaîne vide si le modèle ne renvoie rien", async () => {
    const { createChatCompletion } = await loadModule();
    chatCreate.mockResolvedValue({ choices: [] });
    expect(await createChatCompletion({ messages: [] })).toBe("");
  });
});
