import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActiveItem } from "./nav";

describe("isActiveItem", () => {
  it("active le chemin exact et les sous-pages", () => {
    expect(isActiveItem("/dashboard", "/dashboard")).toBe(true);
    expect(isActiveItem("/dashboard/projects/1", "/dashboard")).toBe(true);
  });

  it("n'active pas un préfixe partiel ni une autre page", () => {
    expect(isActiveItem("/dashboardx", "/dashboard")).toBe(false);
    expect(isActiveItem("/", "/dashboard")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("ne contient que « Projets »", () => {
    expect(NAV_ITEMS).toEqual([{ href: "/dashboard", label: "Projets" }]);
  });
});
