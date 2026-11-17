import { z } from "zod";

export const ConversationSummarySchema = z.object({
  id: z.uuid(),
  firstMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/** GET /api/projects/:id/conversations (du plus récent au plus ancien) */
export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
});
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

export const MessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["visitor", "bot"]),
  body: z.string(),
  createdAt: z.iso.datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

/** GET /api/conversations/:id */
export const ConversationThreadResponseSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  messages: z.array(MessageSchema),
});
export type ConversationThreadResponse = z.infer<typeof ConversationThreadResponseSchema>;
