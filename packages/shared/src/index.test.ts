import { describe, expect, it } from "vitest";
import { APP_NAME } from "./index";

describe("APP_NAME", () => {
  it("vaut Askwell", () => {
    expect(APP_NAME).toBe("Askwell");
  });
});
