export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;
/** Longueur maximale d'un texte collé comme source de connaissances. */
export const MAX_KNOWLEDGE_TEXT_LENGTH = 100_000;
export const MAX_MESSAGE_LENGTH = 1000;
export const CHAT_RATE_LIMIT_PER_MINUTE = 20;
export const CHAT_RETRIEVAL_CHUNKS = 5;

export const KNOWLEDGE_FILE_TYPES = ["pdf", "md", "txt"] as const;
export type KnowledgeFileType = (typeof KNOWLEDGE_FILE_TYPES)[number];
