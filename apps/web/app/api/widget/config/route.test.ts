import { ApiErrorSchema, DEFAULT_WIDGET_CONFIG, WidgetConfigResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWidgetConfig, protectWidgetIp } = vi.hoisted(() => ({ getWidgetConfig: vi.fn(), protectWidgetIp: vi.fn() }));
vi.mock("../../../../lib/chat/arcjet", () => ({ protectWidgetIp }));
vi.mock("../../../../lib/widget/get-widget-config", () => ({ getWidgetConfig }));

import { GET, OPTIONS } from "./route";

const get = (query: string) => GET(new Request(`http://localhost/api/widget/config${query}`));
const PRO = { button_color: "#ff0000", position: "top-left", label: "Aide", animation: "slide", header_text: "Support", show_badge: false };

beforeEach(() => {
  vi.clearAllMocks();
  protectWidgetIp.mockResolvedValue("allowed");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/widget/config", () => {
  it("Gratuit : renvoie les défauts avec le badge, avec CORS * et no-store", async () => {
    getWidgetConfig.mockResolvedValue({ ...DEFAULT_WIDGET_CONFIG, show_badge: true });
    const res = await get("?key=pk_abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(WidgetConfigResponseSchema.parse(await res.json())).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(getWidgetConfig).toHaveBeenCalledWith("pk_abc123");
  });

  it("Pro : renvoie la configuration enregistrée, exactement 6 champs", async () => {
    getWidgetConfig.mockResolvedValue(PRO);
    const body = (await (await get("?key=pk_abc123")).json()) as Record<string, unknown>;
    expect(body).toEqual(PRO);
    expect(Object.keys(body)).toHaveLength(6);
    for (const leak of ["plan", "owner_id", "ownerId", "id", "project_id", "public_key"]) expect(body).not.toHaveProperty(leak);
  });

  it("clé inconnue : 404 apiError, avec CORS", async () => {
    getWidgetConfig.mockResolvedValue(null);
    const res = await get("?key=pk_inconnue");
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it.each([["absente", ""], ["vide", "?key="], ["mal formée", "?key=abc"], ["avec injection", "?key=pk_a%27%20or%201=1"]])(
    "clé %s : 404 sans interroger la base",
    async (_label, query) => {
      const res = await get(query);
      expect(res.status).toBe(404);
      expect(getWidgetConfig).not.toHaveBeenCalled();
    },
  );

  it("erreur de base : 500 sans fuite, avec CORS", async () => {
    getWidgetConfig.mockRejectedValue(new Error("secret interne"));
    const res = await get("?key=pk_abc123");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret interne");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("OPTIONS /api/widget/config", () => {
  it("répond 204 au pré-vol avec CORS, GET uniquement", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });
});

describe("GET /api/widget/config : limite par adresse IP seule (B1-T02)", () => {
  it("100 clés différentes depuis la même IP : bloquées au-delà du seuil, sans lecture de base", async () => {
    const THRESHOLD = 60;
    let count = 0;
    protectWidgetIp.mockImplementation(async () => (++count > THRESHOLD ? "rate_limited" : "allowed"));
    getWidgetConfig.mockResolvedValue(null);

    const statuses: number[] = [];
    for (let i = 0; i < 100; i++) statuses.push((await get(`?key=pk_inconnue${i}`)).status);

    expect(statuses.slice(0, THRESHOLD).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(THRESHOLD).every((s) => s === 429)).toBe(true);
    expect(getWidgetConfig).toHaveBeenCalledTimes(THRESHOLD);
  });

  it("limité : 429 rate_limited avec CORS, sans lecture de base", async () => {
    protectWidgetIp.mockResolvedValue("rate_limited");
    const res = await get("?key=pk_abc123");
    expect(res.status).toBe(429);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("rate_limited");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(getWidgetConfig).not.toHaveBeenCalled();
  });

  it("Arcjet indisponible : la configuration est quand même servie (échec ouvert)", async () => {
    protectWidgetIp.mockResolvedValue("unavailable");
    getWidgetConfig.mockResolvedValue({ ...DEFAULT_WIDGET_CONFIG, show_badge: true });
    expect((await get("?key=pk_abc123")).status).toBe(200);
  });
});
