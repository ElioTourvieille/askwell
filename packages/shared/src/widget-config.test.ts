import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG, WidgetConfigSchema, applyPlanToConfig, type WidgetConfig } from "./widget-config";

const custom: WidgetConfig = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Aide",
  animation: "scale",
  header_text: "Support",
  show_badge: false,
};

describe("applyPlanToConfig", () => {
  it("free : config par défaut + badge affiché", () => {
    expect(applyPlanToConfig("free", custom)).toEqual({ ...DEFAULT_WIDGET_CONFIG, show_badge: true });
  });

  it("pro : config telle quelle", () => {
    expect(applyPlanToConfig("pro", custom)).toEqual(custom);
  });
});

describe("WidgetConfigSchema", () => {
  it("accepte la config par défaut", () => {
    expect(WidgetConfigSchema.safeParse(DEFAULT_WIDGET_CONFIG).success).toBe(true);
  });

  it("refuse une couleur, une position et une animation invalides", () => {
    expect(WidgetConfigSchema.safeParse({ ...custom, button_color: "red" }).success).toBe(false);
    expect(WidgetConfigSchema.safeParse({ ...custom, position: "center" }).success).toBe(false);
    expect(WidgetConfigSchema.safeParse({ ...custom, animation: "spin" }).success).toBe(false);
  });
});
