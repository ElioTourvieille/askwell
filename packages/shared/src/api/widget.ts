import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "../constants";
import { WidgetConfigSchema } from "../widget-config";

const PublicKeySchema = z.string().regex(/^pk_[A-Za-z0-9_-]+$/);

/** GET /api/widget/config */
export const WidgetConfigRequestSchema = z.object({ key: PublicKeySchema });
export type WidgetConfigRequest = z.infer<typeof WidgetConfigRequestSchema>;
export const WidgetConfigResponseSchema = WidgetConfigSchema;
export type WidgetConfigResponse = z.infer<typeof WidgetConfigResponseSchema>;

/** POST /api/widget/chat */
export const ChatRequestSchema = z.object({
  key: PublicKeySchema,
  visitorId: z.string().min(1).max(100),
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export const ChatResponseSchema = z.object({
  conversationId: z.uuid(),
  reply: z.string(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
