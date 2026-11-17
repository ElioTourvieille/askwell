import { z } from "zod";
import {
  KNOWLEDGE_FILE_TYPES,
  MAX_KNOWLEDGE_FILE_BYTES,
  MAX_KNOWLEDGE_TEXT_LENGTH,
} from "../constants";

export const KNOWLEDGE_SOURCE_TYPES = ["text", ...KNOWLEDGE_FILE_TYPES] as const;
export const KNOWLEDGE_SOURCE_STATUSES = ["uploading", "processing", "ready", "failed"] as const;

const TitleSchema = z.string().trim().min(1).max(200);

export const KnowledgeSourceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(KNOWLEDGE_SOURCE_TYPES),
  status: z.enum(KNOWLEDGE_SOURCE_STATUSES),
  createdAt: z.iso.datetime(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

/** POST /api/projects/:id/knowledge (texte collé) */
export const PasteKnowledgeRequestSchema = z.object({
  title: TitleSchema,
  content: z.string().trim().min(1).max(MAX_KNOWLEDGE_TEXT_LENGTH),
});
export type PasteKnowledgeRequest = z.infer<typeof PasteKnowledgeRequestSchema>;
export const PasteKnowledgeResponseSchema = KnowledgeSourceSchema;
export type PasteKnowledgeResponse = z.infer<typeof PasteKnowledgeResponseSchema>;

/** POST /api/projects/:id/knowledge/upload-url */
export const UploadUrlRequestSchema = z.object({
  title: TitleSchema,
  filename: z.string().min(1).max(255),
  type: z.enum(KNOWLEDGE_FILE_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_KNOWLEDGE_FILE_BYTES),
});
export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>;
export const UploadUrlResponseSchema = z.object({
  sourceId: z.uuid(),
  uploadUrl: z.url(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

/** POST /api/projects/:id/knowledge/finalize */
export const FinalizeKnowledgeRequestSchema = z.object({ sourceId: z.uuid() });
export type FinalizeKnowledgeRequest = z.infer<typeof FinalizeKnowledgeRequestSchema>;
export const FinalizeKnowledgeResponseSchema = KnowledgeSourceSchema;
export type FinalizeKnowledgeResponse = z.infer<typeof FinalizeKnowledgeResponseSchema>;

/** DELETE /api/knowledge/:id */
export const DeleteKnowledgeResponseSchema = z.object({ id: z.uuid() });
export type DeleteKnowledgeResponse = z.infer<typeof DeleteKnowledgeResponseSchema>;
