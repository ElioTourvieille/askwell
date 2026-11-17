import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SECRET = ["SUPABASE", "SECRET", "KEY"].join("_");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const files = ["apps", "packages"].flatMap((dir) => sourceFiles(join(REPO_ROOT, dir)));
const rel = (file: string) => relative(REPO_ROOT, file).split(sep).join("/");

describe("secrets", () => {
  it("la clé secrète n'est lue que dans apps/web/lib/supabase/service.ts (tests exclus)", () => {
    const readers = files
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => readFileSync(file, "utf8").includes(SECRET))
      .map(rel);
    expect(readers).toEqual(["apps/web/lib/supabase/service.ts"]);
  });

  it("service.ts commence par import \"server-only\"", () => {
    const service = readFileSync(join(REPO_ROOT, "apps/web/lib/supabase/service.ts"), "utf8");
    expect(service.startsWith('import "server-only";')).toBe(true);
  });

  it("aucun composant client n'importe service.ts", () => {
    const offenders = files
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return /^\s*["']use client["']/.test(text) && /supabase\/service/.test(text);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("aucune variable NEXT_PUBLIC_* ne porte un secret", () => {
    const offenders = files
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => /NEXT_PUBLIC_\w*(SECRET|SERVICE|PRIVATE)/.test(readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
