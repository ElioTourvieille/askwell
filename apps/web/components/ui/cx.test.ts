import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("ignore les valeurs vides", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
});
