import { describe, expect, it } from "vitest";
import { isEmbedPath } from "./paths";

describe("isEmbedPath", () => {
  it("reconnaît /embed et ses sous-chemins", () => {
    expect(isEmbedPath("/embed")).toBe(true);
    expect(isEmbedPath("/embed/x")).toBe(true);
  });
  it("laisse passer les autres pages", () => {
    expect(isEmbedPath("/")).toBe(false);
    expect(isEmbedPath("/dashboard")).toBe(false);
    expect(isEmbedPath("/embedded")).toBe(false);
  });
});
