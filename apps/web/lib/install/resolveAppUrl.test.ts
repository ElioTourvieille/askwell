import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./resolveAppUrl";

const PREVIEW_HOST = "askwell-git-ma-branche-tourvieilles-projects.vercel.app";

describe("resolveAppUrl", () => {
  it("NEXT_PUBLIC_APP_URL valide prime, même en preview", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://askwell.app" })).toBe("https://askwell.app");
    expect(
      resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://askwell.app", VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_HOST }),
    ).toBe("https://askwell.app");
  });

  it("en local, http://localhost est accepté", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it("en preview sans NEXT_PUBLIC_APP_URL : https://<VERCEL_URL>", () => {
    expect(resolveAppUrl({ VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_HOST })).toBe(`https://${PREVIEW_HOST}`);
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "", VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_HOST })).toBe(
      `https://${PREVIEW_HOST}`,
    );
  });

  it.each(["production", "development", undefined])(
    "hors preview (VERCEL_ENV=%s) sans NEXT_PUBLIC_APP_URL : undefined, même avec VERCEL_URL",
    (VERCEL_ENV) => {
      expect(resolveAppUrl({ VERCEL_ENV, VERCEL_URL: PREVIEW_HOST })).toBeUndefined();
    },
  );

  it.each(["pas une url", "javascript:alert(1)", "ftp://askwell.app"])(
    "NEXT_PUBLIC_APP_URL invalide (%s) : repli seulement en preview",
    (NEXT_PUBLIC_APP_URL) => {
      expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL, VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_HOST })).toBe(
        `https://${PREVIEW_HOST}`,
      );
      expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL, VERCEL_ENV: "production", VERCEL_URL: PREVIEW_HOST })).toBeUndefined();
      expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL })).toBeUndefined();
    },
  );

  it("en preview sans VERCEL_URL (ou vide) : undefined", () => {
    expect(resolveAppUrl({ VERCEL_ENV: "preview" })).toBeUndefined();
    expect(resolveAppUrl({ VERCEL_ENV: "preview", VERCEL_URL: "  " })).toBeUndefined();
  });

  it.each(["evil.com/chemin", "user@evil.com", "evil.com?x=1", "https://evil.com"])(
    "VERCEL_URL qui n'est pas un simple nom d'hôte (%s) : undefined",
    (VERCEL_URL) => {
      expect(resolveAppUrl({ VERCEL_ENV: "preview", VERCEL_URL })).toBeUndefined();
    },
  );
});
