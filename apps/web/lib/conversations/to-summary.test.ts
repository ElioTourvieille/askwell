import { describe, expect, it } from "vitest";
import { PREVIEW_MAX_CHARS, toMessage, toPreview, toSummary } from "./to-summary";

describe("toPreview", () => {
  it("garde un texte court et réduit les espaces", () => {
    expect(toPreview("  Bonjour \n  le monde ")).toBe("Bonjour le monde");
  });
  it("tronque un texte long avec « … » sans dépasser la limite", () => {
    const out = toPreview("a".repeat(500));
    expect(Array.from(out)).toHaveLength(PREVIEW_MAX_CHARS);
    expect(out.endsWith("…")).toBe(true);
  });
  it("ne coupe pas un caractère hors BMP", () => {
    expect(toPreview("😀".repeat(500))).toMatch(/^(😀)+…$/u);
  });
  it("laisse le HTML tel quel (texte brut)", () => {
    expect(toPreview("<b>x</b>")).toBe("<b>x</b>");
  });
});

describe("toSummary", () => {
  it("assemble aperçu, compteur et date ISO", () => {
    expect(
      toSummary({
        id: "i",
        created_at: "2026-11-20T10:00:00+00:00",
        message_count: [{ count: 4 }],
        first_messages: [{ body: "Salut" }],
      }),
    ).toEqual({ id: "i", firstMessagePreview: "Salut", messageCount: 4, createdAt: "2026-11-20T10:00:00.000Z" });
  });
  it("tolère une conversation sans message", () => {
    const s = toSummary({ id: "i", created_at: "2026-11-20T10:00:00+00:00", message_count: [], first_messages: [] });
    expect(s.messageCount).toBe(0);
    expect(s.firstMessagePreview).toBe("");
  });
});

describe("toMessage", () => {
  it("convertit visitor et bot, écarte un rôle inconnu", () => {
    const base = { id: "m", body: "x", created_at: "2026-11-20T10:00:00+00:00" };
    expect(toMessage({ ...base, role: "bot" })?.role).toBe("bot");
    expect(toMessage({ ...base, role: "system" })).toBeNull();
  });
});
