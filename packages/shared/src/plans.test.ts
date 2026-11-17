import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "./plans";

describe("PLAN_LIMITS (project.md §5)", () => {
  it("Gratuit", () => {
    expect(PLAN_LIMITS.free).toEqual({
      maxProjects: 1,
      messagesPerMonth: 100,
      maxKnowledgeSources: 3,
      customization: {
        buttonColor: false,
        position: false,
        label: false,
        animation: false,
        headerText: false,
        hideBadge: false,
      },
    });
  });

  it("Pro", () => {
    expect(PLAN_LIMITS.pro.maxProjects).toBe(5);
    expect(PLAN_LIMITS.pro.messagesPerMonth).toBe(2000);
    expect(PLAN_LIMITS.pro.maxKnowledgeSources).toBe(25);
    expect(Object.values(PLAN_LIMITS.pro.customization).every(Boolean)).toBe(true);
  });
});
