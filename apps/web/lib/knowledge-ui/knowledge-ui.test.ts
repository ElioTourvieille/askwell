import { describe, expect, it, vi } from "vitest";
import {
  FinalizeKnowledgeResponseSchema,
  PasteKnowledgeResponseSchema,
  UploadUrlResponseSchema,
} from "@askwell/shared";
import { statusLabel } from "./format";
import { deleteSource, knowledgeLimitMessage, submitFile, submitPaste, validateFile } from "./knowledge-api";

const PROJECT = "0b0f6f7e-3c5a-4d0e-9a52-7b1c3e1d2f10";
const SOURCE = "5d3b5b5e-1d7f-4a1e-8f55-0c2f6a9e7b11";
const source = (over: object = {}) => ({
  id: SOURCE,
  title: "Guide",
  type: "text",
  status: "processing",
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const limitError = () =>
  json({ error: { code: "plan_limit_reached", message: "Limit reached." } }, 402);

/** `fetch` simulé : aucune requête réseau. Les réponses sont consommées dans l'ordre. */
function mockFetch(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn<typeof fetch>(async () => {
    const next = queue.shift();
    if (!next) throw new Error("appel inattendu");
    if (next instanceof Error) throw next;
    return next;
  });
}
/** Appel n° `index` (échoue clairement s'il n'a pas eu lieu). */
function callAt(f: ReturnType<typeof mockFetch>, index: number) {
  const call = f.mock.calls[index];
  if (!call) throw new Error(`appel n°${index} absent`);
  return { url: String(call[0]), init: call[1] };
}

describe("contrat simulé (schémas de packages/shared)", () => {
  it("les réponses simulées respectent les schémas", () => {
    expect(PasteKnowledgeResponseSchema.safeParse(source()).success).toBe(true);
    expect(FinalizeKnowledgeResponseSchema.safeParse(source({ type: "pdf" })).success).toBe(true);
    expect(UploadUrlResponseSchema.safeParse({ sourceId: SOURCE, uploadUrl: "https://s3.example/put" }).success).toBe(true);
  });
});

describe("statusLabel", () => {
  it("uploading s'affiche « en cours de traitement »", () => {
    expect(statusLabel("uploading")).toBe("en cours de traitement");
    expect(statusLabel("processing")).toBe("en cours de traitement");
    expect(statusLabel("ready")).toBe("prête");
    expect(statusLabel("failed")).toBe("échec du traitement");
  });
});

describe("submitPaste", () => {
  it("appelle POST /api/projects/:id/knowledge avec titre et contenu", async () => {
    const f = mockFetch(json(source()));
    const result = await submitPaste(f, PROJECT, "  Guide  ", " Bonjour ");
    expect(result).toEqual({ ok: true, source: source() });
    const call = callAt(f, 0);
    expect(call.url).toBe(`/api/projects/${PROJECT}/knowledge`);
    expect(call.init?.method).toBe("POST");
    expect(JSON.parse(String(call.init?.body))).toEqual({ title: "Guide", content: "Bonjour" });
  });

  it("refuse un titre ou un contenu vide sans appeler le réseau", async () => {
    const f = mockFetch();
    expect((await submitPaste(f, PROJECT, " ", "x")).ok).toBe(false);
    expect((await submitPaste(f, PROJECT, "t", "  ")).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("limite du forfait : message clair avec 3 et 25", async () => {
    const result = await submitPaste(mockFetch(limitError()), PROJECT, "t", "c");
    expect(result).toEqual({ ok: false, message: knowledgeLimitMessage() });
    expect(knowledgeLimitMessage()).toMatch(/3 .*gratuit.*25 .*Pro/);
  });

  it("réseau coupé : message d'erreur, pas d'exception", async () => {
    const result = await submitPaste(mockFetch(new TypeError("fail")), PROJECT, "t", "c");
    expect(result.ok).toBe(false);
  });
});

describe("submitFile", () => {
  const file = new File(["# Titre"], "guide.md", { type: "text/markdown" });

  it("enchaîne upload-url -> PUT direct -> finalize", async () => {
    const uploadUrl = "https://storage.example/bucket/key?sig=abc";
    const f = mockFetch(
      json({ sourceId: SOURCE, uploadUrl }),
      new Response(null, { status: 200 }),
      json(source({ type: "md" })),
    );
    const result = await submitFile(f, PROJECT, "", file);
    expect(result).toEqual({ ok: true, source: source({ type: "md" }) });

    const [reserve, put, finalize] = [callAt(f, 0), callAt(f, 1), callAt(f, 2)];
    expect(reserve.url).toBe(`/api/projects/${PROJECT}/knowledge/upload-url`);
    expect(JSON.parse(String(reserve.init?.body))).toEqual({
      title: "guide",
      filename: "guide.md",
      type: "md",
      sizeBytes: file.size,
    });
    expect(put.url).toBe(uploadUrl);
    expect(put.init?.method).toBe("PUT");
    expect(put.init?.body).toBe(file);
    expect(finalize.url).toBe(`/api/projects/${PROJECT}/knowledge/finalize`);
    expect(JSON.parse(String(finalize.init?.body))).toEqual({ sourceId: SOURCE });
  });

  it("n'appelle pas finalize si l'envoi direct échoue", async () => {
    const f = mockFetch(json({ sourceId: SOURCE, uploadUrl: "https://storage.example/x" }), new Response(null, { status: 403 }));
    const result = await submitFile(f, PROJECT, "Mon guide", file);
    expect(result.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("limite du forfait à la réservation : message clair, aucun PUT", async () => {
    const f = mockFetch(limitError());
    const result = await submitFile(f, PROJECT, "t", file);
    expect(result).toEqual({ ok: false, message: knowledgeLimitMessage() });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refuse un format ou une taille invalide sans appeler le réseau", async () => {
    const f = mockFetch();
    expect((await submitFile(f, PROJECT, "t", new File(["x"], "image.png"))).ok).toBe(false);
    expect(validateFile({ name: "gros.pdf", size: 10 * 1024 * 1024 + 1 }).ok).toBe(false);
    expect(validateFile({ name: "ok.PDF", size: 10 * 1024 * 1024 })).toEqual({ ok: true, type: "pdf" });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("deleteSource", () => {
  it("appelle DELETE /api/knowledge/:id", async () => {
    const f = mockFetch(json({ id: SOURCE }));
    expect(await deleteSource(f, SOURCE)).toEqual({ ok: true });
    const call = callAt(f, 0);
    expect(call.url).toBe(`/api/knowledge/${SOURCE}`);
    expect(call.init?.method).toBe("DELETE");
  });

  it("erreur serveur : renvoie son message", async () => {
    const f = mockFetch(json({ error: { code: "not_found", message: "Source introuvable." } }, 404));
    expect(await deleteSource(f, SOURCE)).toEqual({ ok: false, message: "Source introuvable." });
  });
});
