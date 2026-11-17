import { z } from "zod";
import { WidgetConfigSchema } from "../widget-config";

export const IdParamsSchema = z.object({ id: z.uuid() });
export type IdParams = z.infer<typeof IdParamsSchema>;

const ProjectNameSchema = z.string().trim().min(1).max(100);

export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  publicKey: z.string(),
  messagesUsed: z.number().int().nonnegative(),
  periodStart: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

/** GET /api/projects */
export const ListProjectsResponseSchema = z.object({ projects: z.array(ProjectSchema) });
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;

/** POST /api/projects */
export const CreateProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export const CreateProjectResponseSchema = ProjectSchema;
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

/** PATCH /api/projects/:id */
export const RenameProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type RenameProjectRequest = z.infer<typeof RenameProjectRequestSchema>;
export const RenameProjectResponseSchema = ProjectSchema;
export type RenameProjectResponse = z.infer<typeof RenameProjectResponseSchema>;

/** DELETE /api/projects/:id */
export const DeleteProjectResponseSchema = z.object({ id: z.uuid() });
export type DeleteProjectResponse = z.infer<typeof DeleteProjectResponseSchema>;

/** PATCH /api/projects/:id/config (402 si Free) */
export const UpdateProjectConfigRequestSchema = WidgetConfigSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Au moins un champ est requis" },
);
export type UpdateProjectConfigRequest = z.infer<typeof UpdateProjectConfigRequestSchema>;
export const UpdateProjectConfigResponseSchema = WidgetConfigSchema;
export type UpdateProjectConfigResponse = z.infer<typeof UpdateProjectConfigResponseSchema>;
