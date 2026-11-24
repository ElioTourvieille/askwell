import { describe, expect, it } from "vitest";
import { readPosthogConfig } from "./config";

describe("readPosthogConfig", () => {
  it("renvoie la clé et l'hôte quand les deux sont valides", () => {
    expect(
      readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_test", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com" }),
    ).toEqual({ key: "phc_test", host: "https://eu.i.posthog.com" });
  });

  it("renvoie null sans variables (no-op)", () => {
    expect(readPosthogConfig({})).toBeNull();
  });

  it("renvoie null si la clé est vide ou l'hôte invalide", () => {
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "", NEXT_PUBLIC_POSTHOG_HOST: "https://x.io" })).toBeNull();
    expect(readPosthogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_test", NEXT_PUBLIC_POSTHOG_HOST: "pas-une-url" })).toBeNull();
  });
});
