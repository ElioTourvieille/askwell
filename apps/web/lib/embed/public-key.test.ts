import { describe, expect, it } from "vitest";
import { readPublicKey } from "./public-key";

describe("readPublicKey", () => {
  it("lit la clé de l'URL de l'iframe", () => {
    expect(readPublicKey("?key=pk_abc123&origin=https%3A%2F%2Fclient.example")).toBe("pk_abc123");
    expect(readPublicKey("key=pk_A-b_9")).toBe("pk_A-b_9");
  });

  it.each([
    ["absente", ""],
    ["vide", "?key="],
    ["sans le préfixe pk_", "?key=abc123"],
    ["avec des caractères interdits", "?key=pk_a%20b"],
    ["avec du HTML", "?key=pk_x%22%3E%3Cscript%3E"],
  ])("renvoie null quand la clé est %s", (_label, search) => {
    expect(readPublicKey(search)).toBeNull();
  });
});
