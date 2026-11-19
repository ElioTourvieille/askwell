import { describe, expect, it } from "vitest";
import { buildInstallSnippet } from "./buildInstallSnippet";

describe("buildInstallSnippet", () => {
  it("construit la balise avec l'URL et la clé publique", () => {
    expect(buildInstallSnippet("https://askwell.app", "pk_abc")).toBe(
      '<script src="https://askwell.app/widget.js" data-key="pk_abc"></script>',
    );
  });

  it("donne le même résultat avec ou sans « / » final", () => {
    const sans = buildInstallSnippet("https://askwell.app", "pk_abc");
    expect(buildInstallSnippet("https://askwell.app/", "pk_abc")).toBe(sans);
    expect(buildInstallSnippet("https://askwell.app///", "pk_abc")).toBe(sans);
  });

  it("garde un éventuel chemin de base", () => {
    expect(buildInstallSnippet("https://exemple.fr/askwell/", "pk_abc")).toBe(
      '<script src="https://exemple.fr/askwell/widget.js" data-key="pk_abc"></script>',
    );
  });

  it("échappe la clé : l'extrait reste du texte, jamais du HTML injecté", () => {
    const snippet = buildInstallSnippet("https://askwell.app", `pk"><img src=x onerror=alert(1)>&'`);
    expect(snippet).toBe(
      '<script src="https://askwell.app/widget.js" data-key="pk&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&amp;&#39;"></script>',
    );
    expect(snippet).not.toContain("<img");
  });

  it.each([undefined, null, "", "   "])("appUrl absente (%j) → null", (appUrl) => {
    expect(buildInstallSnippet(appUrl, "pk_abc")).toBeNull();
  });

  it.each(["pas une url", "javascript:alert(1)", "ftp://askwell.app"])("appUrl invalide (%s) → null", (appUrl) => {
    expect(buildInstallSnippet(appUrl, "pk_abc")).toBeNull();
  });

  it("ne produit jamais « undefined » dans l'extrait", () => {
    expect(buildInstallSnippet(undefined, "pk_abc")).toBeNull();
  });
});
