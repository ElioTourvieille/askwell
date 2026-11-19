import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { KNOWLEDGE_FILE_TYPES } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; ici on ne teste que la logique.
vi.mock("server-only", () => ({}));

const ENV = {
  NEON_STORAGE_ENDPOINT: "https://br-test.storage.c-2.us-east-2.aws.neon.tech",
  NEON_STORAGE_REGION: "us-east-2",
  NEON_STORAGE_ACCESS_KEY_ID: "nak_test_id",
  NEON_STORAGE_SECRET_ACCESS_KEY: "nsk_test_secret",
};

async function load() {
  vi.resetModules();
  return import("./storage");
}

beforeEach(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("table des Content-Type", () => {
  it("est fixe : pdf, md et txt (accord avec la page Connaissances)", async () => {
    const { UPLOAD_CONTENT_TYPES } = await load();
    expect(UPLOAD_CONTENT_TYPES).toEqual({
      pdf: "application/pdf",
      md: "text/markdown",
      txt: "text/plain",
    });
    expect(Object.keys(UPLOAD_CONTENT_TYPES).sort()).toEqual([...KNOWLEDGE_FILE_TYPES].sort());
  });
});

describe("createUploadUrl (calcul local, aucun appel réseau)", () => {
  it("expire en 5 minutes", async () => {
    const { createUploadUrl, UPLOAD_URL_TTL_SECONDS } = await load();
    const url = new URL(await createUploadUrl("projects/p1/o1", "pdf"));
    expect(UPLOAD_URL_TTL_SECONDS).toBe(300);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it.each([
    ["pdf", "application/pdf"],
    ["md", "text/markdown"],
    ["txt", "text/plain"],
  ] as const)("signe le content-type de la table pour %s (%s)", async (type, contentType) => {
    const { createUploadUrl } = await load();
    const url = new URL(await createUploadUrl("projects/p1/o1", type));
    const signed = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
    expect(signed).toContain("content-type");
    expect(signed).toContain("host");
    expect(contentType).toBe((await load()).UPLOAD_CONTENT_TYPES[type]);
  });

  it("deux types de fichier donnent deux signatures différentes", async () => {
    const { createUploadUrl } = await load();
    const [a, b] = await Promise.all([
      createUploadUrl("projects/p1/o1", "pdf"),
      createUploadUrl("projects/p1/o1", "md"),
    ]);
    expect(new URL(a).searchParams.get("X-Amz-Signature")).not.toBe(new URL(b).searchParams.get("X-Amz-Signature"));
  });

  it("vise le compartiment `knowledge` en chemin (path-style) sur l'endpoint Neon", async () => {
    const { createUploadUrl } = await load();
    const url = new URL(await createUploadUrl("projects/p1/o1", "txt"));
    expect(url.origin).toBe(ENV.NEON_STORAGE_ENDPOINT);
    expect(url.pathname).toBe("/knowledge/projects/p1/o1");
  });

  it("ne contient jamais la clé secrète", async () => {
    const { createUploadUrl } = await load();
    const url = await createUploadUrl("projects/p1/o1", "pdf");
    expect(url).not.toContain(ENV.NEON_STORAGE_SECRET_ACCESS_KEY);
  });
});

describe("configuration", () => {
  it.each(Object.keys(ENV))("lève une erreur claire, sans valeur, si %s est absente", async (name) => {
    vi.stubEnv(name, "");
    const { createUploadUrl } = await load();
    await expect(createUploadUrl("k", "pdf")).rejects.toThrow(new RegExp(`${name} est absente`));
  });

  it("n'exige pas les clés à l'import", async () => {
    for (const name of Object.keys(ENV)) vi.stubEnv(name, "");
    await expect(load()).resolves.toBeDefined();
  });
});

describe("readObject / deleteObject (client S3 simulé)", () => {
  it("lit un objet et renvoie ses octets", async () => {
    const { readObject } = await load();
    const bytes = new Uint8Array([1, 2, 3]);
    vi.spyOn(S3Client.prototype, "send").mockImplementation(
      async () => ({ ContentLength: 3, Body: { transformToByteArray: async () => bytes } }) as never,
    );
    await expect(readObject("k", 10)).resolves.toBe(bytes);
  });

  it("refuse sans lire le corps un objet annoncé plus gros que la limite", async () => {
    const { readObject, ObjectTooLargeError } = await load();
    const transformToByteArray = vi.fn();
    const destroy = vi.fn();
    vi.spyOn(S3Client.prototype, "send").mockImplementation(
      async () => ({ ContentLength: 11, Body: { transformToByteArray, destroy } }) as never,
    );
    await expect(readObject("k", 10)).rejects.toBeInstanceOf(ObjectTooLargeError);
    expect(transformToByteArray).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it("supprime l'objet du compartiment `knowledge`", async () => {
    const { deleteObject } = await load();
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}) as never);
    await deleteObject("projects/p1/o1");
    const command = send.mock.calls[0]?.[0] as { input: { Bucket: string; Key: string } };
    expect(command.input).toEqual({ Bucket: "knowledge", Key: "projects/p1/o1" });
  });
});

describe("buildObjectKey", () => {
  it("range les objets par projet", async () => {
    const { buildObjectKey } = await load();
    expect(buildObjectKey("p1", "o1")).toBe("projects/p1/o1");
  });
});

describe("secrets", () => {
  const ROOT = join(__dirname, "..", "..", "..");
  const SKIP = new Set(["node_modules", ".next", "dist", ".git"]);
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : walk(path);
      return /\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });

  it("les variables NEON_STORAGE_* ne sont lues que dans apps/web/lib/storage.ts", () => {
    const readers = ["apps", "packages"]
      .flatMap((dir) => walk(join(ROOT, dir)))
      .filter((file) => readFileSync(file, "utf8").includes("NEON_STORAGE_"))
      .map((file) => relative(ROOT, file).split(sep).join("/"));
    expect(readers).toEqual(["apps/web/lib/storage.ts"]);
  });

  it("storage.ts commence par import \"server-only\"", () => {
    expect(readFileSync(join(ROOT, "apps/web/lib/storage.ts"), "utf8").startsWith('import "server-only";')).toBe(true);
  });
});
