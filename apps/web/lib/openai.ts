import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/** Modèle d'embedding. 1 536 dimensions, imposé par la colonne `vector(1536)` (project.md §3). */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Modèle de chat : petit modèle économique (décision du Product Owner). */
export const CHAT_MODEL = "gpt-5-mini";

/** Nombre de textes par appel d'embedding (la limite de l'API est de 2 048 entrées par requête). */
const EMBEDDING_BATCH_SIZE = 100;

let client: OpenAI | undefined;

/**
 * Client OpenAI unique, créé à la demande (jamais à l'import, pour que `next build` n'exige pas la clé).
 * Serveur uniquement (`import "server-only"`) : `OPENAI_API_KEY` ne doit jamais atteindre le bundle client.
 */
export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Message sans valeur : jamais la clé dans une erreur ou un journal.
    throw new Error(
      "OPENAI_API_KEY est absente : le client OpenAI ne peut pas être créé (voir project.md §11).",
    );
  }
  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Calcule les représentations (embeddings) des textes, par lots, dans le même ordre que l'entrée.
 * Chaque vecteur a `EMBEDDING_DIMENSIONS` (1 536) valeurs.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getOpenAI();
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    if (response.data.length !== batch.length) {
      throw new Error(
        `OpenAI a renvoyé ${response.data.length} vecteur(s) pour ${batch.length} texte(s).`,
      );
    }
    // L'API renvoie `index` : on remet dans l'ordre d'entrée sans supposer l'ordre de réponse.
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) vectors.push(item.embedding);
  }
  return vectors;
}

export type ChatCompletionInput = {
  messages: ChatCompletionMessageParam[];
  /** Plafond de tokens de la réponse. */
  maxCompletionTokens?: number;
};

/** Appelle le modèle de chat et renvoie le texte de la réponse (chaîne vide si le modèle ne renvoie rien). */
export async function createChatCompletion(input: ChatCompletionInput): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: input.messages,
    ...(input.maxCompletionTokens !== undefined && {
      max_completion_tokens: input.maxCompletionTokens,
    }),
  });
  return completion.choices[0]?.message?.content ?? "";
}
