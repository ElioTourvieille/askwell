import { z } from "zod";

/** GET /api/posthog-config */
export const PosthogConfigResponseSchema = z.object({
  key: z.string().min(1),
  host: z.url(),
});
export type PosthogConfigResponse = z.infer<typeof PosthogConfigResponseSchema>;
