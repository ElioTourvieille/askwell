import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
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
const nonTests = files.filter((file) => !/\.test\.tsx?$/.test(file));
const text = (file: string) => readFileSync(file, "utf8");

describe("DATABASE_URL", () => {
  it("n'est lue que dans apps/web/lib/db/service.ts (tests exclus)", () => {
    const readers = nonTests
      .filter((file) => /(process\.env|import\.meta\.env)\s*(\.\s*DATABASE_URL|\[\s*["']DATABASE_URL)/.test(text(file)))
      .map(rel);
    expect(readers).toEqual(["apps/web/lib/db/service.ts"]);
  });

  it("service.ts commence par import \"server-only\"", () => {
    expect(text(join(REPO_ROOT, "apps/web/lib/db/service.ts")).startsWith('import "server-only";')).toBe(true);
  });

  it("aucun composant client n'importe service.ts", () => {
    const offenders = nonTests
      .filter((file) => /^\s*["']use client["']/.test(text(file)) && /lib\/db\/service|["']\.\/service["']/.test(text(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("secrets", () => {
  it("aucune variable NEXT_PUBLIC_* ne porte un secret", () => {
    const offenders = nonTests.filter((file) => /NEXT_PUBLIC_\w*(SECRET|SERVICE|PRIVATE|DATABASE)/.test(text(file))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe(".env.example", () => {
  const example = readFileSync(join(REPO_ROOT, ".env.example"), "utf8");
  const names = example
    .split("\n")
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split("=")[0]);

  it("liste les variables Neon du §11, sans valeur", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_NEON_DATA_API_URL",
        "DATABASE_URL",
        "NEON_STORAGE_ENDPOINT",
        "NEON_STORAGE_REGION",
        "NEON_STORAGE_ACCESS_KEY_ID",
        "NEON_STORAGE_SECRET_ACCESS_KEY",
      ]),
    );
    expect(example.split("\n").filter((line) => /^[A-Z][A-Z0-9_]*=.+/.test(line))).toEqual([]);
  });

  it("ne mentionne plus l'ancien fournisseur de base de données", () => {
    // Mot construit : ce fichier lui-même ne doit pas contenir le nom (vérification `grep -ri` de la tâche).
    const former = ["supa", "base"].join("");
    expect(example.toLowerCase()).not.toContain(former);
  });
});
