import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readConnectionString } from "./connection-string.ts";

const here = dirname(fileURLToPath(import.meta.url));

function pipe(text: string) {
  const input = new PassThrough();
  input.end(text);
  return input;
}

describe("readConnectionString", () => {
  it("lit la chaîne sur l'entrée standard redirigée, sans rien afficher", async () => {
    const output = new PassThrough();
    const written: string[] = [];
    output.on("data", (chunk) => written.push(String(chunk)));

    const value = await readConnectionString(pipe("postgresql://owner:secret@host/db?sslmode=require\n"), output);
    expect(value).toBe("postgresql://owner:secret@host/db?sslmode=require");
    expect(written.join("")).not.toContain("secret");
  });

  it("refuse une valeur qui n'est pas une chaîne postgresql://", async () => {
    await expect(readConnectionString(pipe("n'importe quoi\n"), new PassThrough())).rejects.toThrow(/invalide/);
    await expect(readConnectionString(pipe(""), new PassThrough())).rejects.toThrow(/invalide/);
  });

  it("ne message d'erreur ne contient pas la valeur saisie", async () => {
    await expect(readConnectionString(pipe("mot-de-passe-secret\n"), new PassThrough())).rejects.not.toThrow(
      /mot-de-passe-secret/,
    );
  });
});

describe("db:migrate ne lit jamais la chaîne depuis un environnement ou un fichier", () => {
  it("migrate.ts et connection-string.ts n'utilisent ni process.env ni écriture de fichier", () => {
    for (const file of ["migrate.ts", "connection-string.ts", "runner.ts"]) {
      const source = readFileSync(join(here, file), "utf8");
      expect(source, file).not.toMatch(/process\.env|DATABASE_URL|writeFile|appendFile|dotenv/);
    }
  });
});
