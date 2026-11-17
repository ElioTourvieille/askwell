import { describe, expect, it } from "vitest";
import { WIDGET_CORS_HEADERS, withWidgetHeaders } from "./cors";

describe("withWidgetHeaders", () => {
  it("ajoute CORS * et no-store, sans toucher au corps ni au statut", async () => {
    const res = withWidgetHeaders(Response.json({ a: 1 }, { status: 404 }));
    expect(res.status).toBe(404);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/json/);
    await expect(res.json()).resolves.toEqual({ a: 1 });
  });

  it("n'autorise que GET et OPTIONS", () => {
    expect(WIDGET_CORS_HEADERS["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
  });
});
