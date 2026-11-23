import { PLAN_LIMITS } from "@askwell/shared";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsageMeter } from "../../components/projects/usage";
import { computeUsage } from "./compute-usage";

const NOW = new Date("2026-11-23T10:00:00.000Z");
const IN_MONTH = "2026-11-02T08:00:00.000Z";

describe("computeUsage", () => {
  it("limite du forfait gratuit et du forfait Pro", () => {
    expect(computeUsage({ messagesUsed: 10, periodStart: IN_MONTH, plan: "free", now: NOW }).limit).toBe(
      PLAN_LIMITS.free.messagesPerMonth,
    );
    expect(computeUsage({ messagesUsed: 10, periodStart: IN_MONTH, plan: "pro", now: NOW }).limit).toBe(
      PLAN_LIMITS.pro.messagesPerMonth,
    );
  });

  it("pourcentage arrondi, limite non atteinte", () => {
    const usage = computeUsage({ messagesUsed: 25, periodStart: IN_MONTH, plan: "free", now: NOW });
    expect(usage).toMatchObject({ used: 25, percent: 25, reached: false });
  });

  it("limite atteinte, pourcentage plafonné à 100", () => {
    expect(computeUsage({ messagesUsed: 100, periodStart: IN_MONTH, plan: "free", now: NOW })).toMatchObject({
      percent: 100,
      reached: true,
    });
    expect(computeUsage({ messagesUsed: 150, periodStart: IN_MONTH, plan: "free", now: NOW }).percent).toBe(100);
    // Même compteur : atteint en gratuit, pas en Pro.
    expect(computeUsage({ messagesUsed: 100, periodStart: IN_MONTH, plan: "pro", now: NOW }).reached).toBe(false);
  });

  it("remise à zéro paresseuse : période d'un mois précédent -> 0, jamais atteinte", () => {
    const usage = computeUsage({
      messagesUsed: 100,
      periodStart: "2026-10-31T23:59:59.000Z",
      plan: "free",
      now: NOW,
    });
    expect(usage).toMatchObject({ used: 0, percent: 0, reached: false });
  });

  it("le tout début du mois courant compte pour le mois courant", () => {
    expect(
      computeUsage({ messagesUsed: 7, periodStart: "2026-11-01T00:00:00.000Z", plan: "free", now: NOW }).used,
    ).toBe(7);
  });

  it("prochaine remise à zéro : début du mois suivant, y compris en décembre", () => {
    expect(computeUsage({ messagesUsed: 0, periodStart: IN_MONTH, plan: "free", now: NOW }).nextResetAt).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(
      computeUsage({
        messagesUsed: 0,
        periodStart: "2026-12-05T00:00:00.000Z",
        plan: "free",
        now: new Date("2026-12-15T00:00:00.000Z"),
      }).nextResetAt,
    ).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("UsageMeter", () => {
  it("affiche « X / Y messages ce mois-ci », la barre et la date de remise à zéro", () => {
    const html = renderToStaticMarkup(
      h(UsageMeter, { messagesUsed: 25, periodStart: IN_MONTH, plan: "free", now: NOW }),
    );
    expect(html).toContain("25 / 100 messages ce mois-ci");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("width:25%");
    expect(html).toContain("1 décembre 2026");
    expect(html).not.toContain("Limite atteinte");
  });

  it("à la limite : badge d'avertissement", () => {
    const html = renderToStaticMarkup(
      h(UsageMeter, { messagesUsed: 100, periodStart: IN_MONTH, plan: "free", now: NOW }),
    );
    expect(html).toContain("100 / 100 messages ce mois-ci");
    expect(html).toContain("Limite atteinte");
  });

  it("forfait Pro : limite 2000", () => {
    const html = renderToStaticMarkup(
      h(UsageMeter, { messagesUsed: 100, periodStart: IN_MONTH, plan: "pro", now: NOW }),
    );
    expect(html).toContain("100 / 2000 messages ce mois-ci");
    expect(html).not.toContain("Limite atteinte");
  });
});
