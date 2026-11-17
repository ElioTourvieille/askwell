import { z } from "zod";
import type { Plan } from "./plans";

export const WIDGET_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export const WIDGET_ANIMATIONS = ["fade", "slide", "scale"] as const;

export const WidgetConfigSchema = z.object({
  button_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.enum(WIDGET_POSITIONS),
  label: z.string().trim().min(1).max(40),
  animation: z.enum(WIDGET_ANIMATIONS),
  header_text: z.string().trim().min(1).max(60),
  show_badge: z.boolean(),
});
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  button_color: "#000000",
  position: "bottom-right",
  label: "Besoin d'aide ?",
  animation: "fade",
  header_text: "Assistant",
  show_badge: true,
};

/** Free = valeurs par défaut + badge affiché ; Pro = configuration telle quelle. */
export function applyPlanToConfig(plan: Plan, config: WidgetConfig): WidgetConfig {
  if (plan === "pro") return { ...config };
  return { ...DEFAULT_WIDGET_CONFIG, show_badge: true };
}
