import { describe, expect, it } from "vitest";
import { isApiRoute, isProtectedRoute } from "./routes";

describe("isProtectedRoute", () => {
  it.each([
    "/dashboard",
    "/dashboard/x",
    "/api/projects",
    "/api/projects/1/knowledge",
    "/api/knowledge/1",
    "/api/conversations/1",
  ])("protège %s", (path) => {
    expect(isProtectedRoute(path)).toBe(true);
  });

  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/embed",
    "/embed/abc",
    "/api/widget/chat",
    "/api/clerk/webhook",
    "/api/posthog-config",
    "/dashboardx",
    "/api/projectsx",
  ])("laisse %s public", (path) => {
    expect(isProtectedRoute(path)).toBe(false);
  });
});

describe("isApiRoute", () => {
  it("distingue les API des pages", () => {
    expect(isApiRoute("/api/projects")).toBe(true);
    expect(isApiRoute("/dashboard")).toBe(false);
    expect(isApiRoute("/apiary")).toBe(false);
  });
});
