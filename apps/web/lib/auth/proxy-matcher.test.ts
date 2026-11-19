import { describe, expect, it } from "vitest";
import { config } from "../../proxy";
import { isProtectedRoute } from "./routes";

/**
 * Le `matcher` de proxy.ts décide quelles routes passent par clerkMiddleware.
 * Une route qui y passe peut déclencher le handshake Clerk (redirections vers
 * clerk.accounts.dev), ce qui boucle dans l'iframe tierce du widget (§6.5, §9).
 * Next compile chaque entrée du matcher en expression régulière sur le chemin.
 */
const matchers = config.matcher.map((m) => new RegExp(`^${m}$`));

const runsClerk = (pathname: string) => matchers.some((re) => re.test(pathname));

describe("matcher de proxy.ts", () => {
  it.each([
    "/embed",
    "/embed/",
    "/embed/abc",
    "/api/widget/config",
    "/api/widget/chat",
    "/api/widget",
  ])("ne passe pas %s par Clerk (public, pas de handshake)", (path) => {
    expect(runsClerk(path)).toBe(false);
  });

  it.each([
    "/dashboard",
    "/dashboard/projects/1/install",
    "/api/projects",
    "/api/projects/1/knowledge",
    "/api/knowledge/1",
    "/api/conversations/1",
  ])("garde %s derrière Clerk", (path) => {
    expect(runsClerk(path)).toBe(true);
  });

  it.each(["/", "/sign-in", "/sign-up", "/api/clerk/webhook", "/api/posthog-config"])(
    "ne change pas le comportement de %s",
    (path) => {
      expect(runsClerk(path)).toBe(true);
    },
  );

  it("n'exclut que les segments exacts, pas les préfixes voisins", () => {
    expect(runsClerk("/embedx")).toBe(true);
    expect(runsClerk("/api/widgetx")).toBe(true);
  });

  it("garde l'exclusion des fichiers statiques et des internes de Next", () => {
    expect(runsClerk("/widget.js")).toBe(false);
    expect(runsClerk("/_next/static/a.js")).toBe(false);
  });

  it("toute route protégée reste couverte par le matcher", () => {
    for (const path of ["/dashboard", "/api/projects", "/api/knowledge", "/api/conversations"]) {
      expect(isProtectedRoute(path)).toBe(true);
      expect(runsClerk(path)).toBe(true);
    }
  });
});
