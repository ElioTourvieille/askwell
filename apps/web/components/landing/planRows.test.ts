import { PLAN_LIMITS } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { buildPlanRows } from "./planRows";

describe("buildPlanRows", () => {
  it("couvre toutes les lignes du tableau du §5", () => {
    expect(buildPlanRows().map((r) => r.label)).toEqual([
      "Projets",
      "Messages par mois (par projet)",
      "Sources de connaissances (par projet)",
      "Couleur du bouton",
      "Position du bouton",
      "Libellé du bouton",
      "Animation d'ouverture",
      "Texte de l'en-tête",
      "Badge « Powered by »",
    ]);
  });

  it("lit les nombres dans PLAN_LIMITS", () => {
    const rows = buildPlanRows();
    const digits = (s: string | undefined) => Number((s ?? "").replace(/\D/g, ""));
    expect(digits(rows[0]?.free)).toBe(PLAN_LIMITS.free.maxProjects);
    expect(digits(rows[0]?.pro)).toBe(PLAN_LIMITS.pro.maxProjects);
    expect(digits(rows[1]?.free)).toBe(PLAN_LIMITS.free.messagesPerMonth);
    expect(digits(rows[1]?.pro)).toBe(PLAN_LIMITS.pro.messagesPerMonth);
    expect(digits(rows[2]?.free)).toBe(PLAN_LIMITS.free.maxKnowledgeSources);
    expect(digits(rows[2]?.pro)).toBe(PLAN_LIMITS.pro.maxKnowledgeSources);
  });

  it("suit les droits de personnalisation et le badge", () => {
    const rows = buildPlanRows();
    const badge = rows.at(-1);
    expect(badge).toEqual({ label: "Badge « Powered by »", free: "Affiché", pro: "Masqué" });
    expect(rows[3]).toMatchObject({ free: "Par défaut", pro: "Au choix" });
  });
});
