import { DEFAULT_WIDGET_CONFIG, WidgetConfigSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db/service", () => ({ createServiceClient: () => ({ query }) }));

import { getWidgetConfig } from "./get-widget-config";

const SAVED = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Aide",
  animation: "slide",
  header_text: "Support",
  show_badge: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getWidgetConfig", () => {
  it("Pro : renvoie la configuration enregistrée", async () => {
    query.mockResolvedValue([{ ...SAVED, plan: "pro" }]);
    await expect(getWidgetConfig("pk_abc")).resolves.toEqual(SAVED);
  });

  it("Gratuit : valeurs par défaut et badge affiché, quoi que la ligne contienne", async () => {
    query.mockResolvedValue([{ ...SAVED, plan: "free" }]);
    await expect(getWidgetConfig("pk_abc")).resolves.toEqual({ ...DEFAULT_WIDGET_CONFIG, show_badge: true });
  });

  it("clé inconnue : null", async () => {
    query.mockResolvedValue([]);
    await expect(getWidgetConfig("pk_inconnue")).resolves.toBeNull();
  });

  it("n'expose que les 6 champs (aucune fuite de plan, d'id ou de propriétaire)", async () => {
    query.mockResolvedValue([{ ...SAVED, plan: "pro", owner_id: "user_a", id: "x", project_id: "y" }]);
    const config = await getWidgetConfig("pk_abc");
    expect(Object.keys(config ?? {}).sort()).toEqual(Object.keys(WidgetConfigSchema.shape).sort());
  });

  it("passe la clé en paramètre, jamais concaténée au SQL", async () => {
    query.mockResolvedValue([]);
    const hostile = "pk_x' or 1=1 --";
    await getWidgetConfig(hostile);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("p.public_key = $1"), [hostile]);
    expect(query.mock.calls[0]?.[0]).not.toContain("or 1=1");
  });

  it("lève sur un forfait inconnu ou une configuration invalide en base", async () => {
    query.mockResolvedValue([{ ...SAVED, plan: "enterprise" }]);
    await expect(getWidgetConfig("pk_abc")).rejects.toThrow(/Forfait inconnu/);
    query.mockResolvedValue([{ ...SAVED, plan: "pro", button_color: "rouge" }]);
    await expect(getWidgetConfig("pk_abc")).rejects.toThrow();
  });
});
