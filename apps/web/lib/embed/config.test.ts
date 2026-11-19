import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getWidgetConfig } = vi.hoisted(() => ({ getWidgetConfig: vi.fn() }));
vi.mock("../widget/get-widget-config", () => ({ getWidgetConfig }));

import { getEmbedConfig } from "./config";

const CONFIG = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Aide",
  animation: "slide",
  header_text: "Support",
  show_badge: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getEmbedConfig", () => {
  it("clé connue : renvoie la configuration du projet (forfait déjà appliqué)", async () => {
    getWidgetConfig.mockResolvedValue(CONFIG);
    await expect(getEmbedConfig("pk_abc")).resolves.toEqual(CONFIG);
    expect(getWidgetConfig).toHaveBeenCalledWith("pk_abc");
  });

  it("clé inconnue : null", async () => {
    getWidgetConfig.mockResolvedValue(null);
    await expect(getEmbedConfig("pk_inconnue")).resolves.toBeNull();
  });

  it("erreur de la base : null, sans fuite de détail", async () => {
    getWidgetConfig.mockRejectedValue(new Error("connection to db.secret.internal refused"));
    const result = await getEmbedConfig("pk_abc");
    expect(result).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
