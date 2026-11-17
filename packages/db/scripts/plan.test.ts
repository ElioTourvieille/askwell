import { describe, expect, it } from "vitest";
import { MIGRATION_FILE_PATTERN, pickPendingMigrations } from "./plan.ts";

const m = (version: string) => ({ version, name: `m${version}` });

describe("pickPendingMigrations", () => {
  it("renvoie tout quand rien n'est appliqué, dans l'ordre des horodatages", () => {
    const result = pickPendingMigrations([m("20261118000000"), m("20261117000000")], []);
    expect(result.map((x) => x.version)).toEqual(["20261117000000", "20261118000000"]);
  });

  it("ne renvoie que les migrations pas encore appliquées", () => {
    const result = pickPendingMigrations([m("20261117000000"), m("20261118000000")], ["20261117000000"]);
    expect(result.map((x) => x.version)).toEqual(["20261118000000"]);
  });

  it("renvoie une liste vide quand tout est appliqué", () => {
    expect(pickPendingMigrations([m("20261117000000")], ["20261117000000"])).toEqual([]);
  });

  it("refuse une version en double", () => {
    expect(() => pickPendingMigrations([m("20261117000000"), m("20261117000000")], [])).toThrow(/Deux migrations/);
  });

  it("refuse une version appliquée dont le fichier a disparu", () => {
    expect(() => pickPendingMigrations([m("20261118000000")], ["20261117000000"])).toThrow(/introuvable/);
  });

  it("refuse une migration en attente plus ancienne que la dernière appliquée", () => {
    expect(() =>
      pickPendingMigrations([m("20261116000000"), m("20261118000000")], ["20261118000000"]),
    ).toThrow(/ordre rompu/);
  });
});

describe("MIGRATION_FILE_PATTERN", () => {
  it("accepte <horodatage>_<nom>.sql et refuse le reste", () => {
    expect(MIGRATION_FILE_PATTERN.test("20261117150000_accounts_projects_widget_configs.sql")).toBe(true);
    expect(MIGRATION_FILE_PATTERN.test("2026_11_17.sql")).toBe(false);
    expect(MIGRATION_FILE_PATTERN.test("20261117150000_Majuscules.sql")).toBe(false);
    expect(MIGRATION_FILE_PATTERN.test("20261117150000_x.txt")).toBe(false);
  });
});
