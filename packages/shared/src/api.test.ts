import { describe, expect, it } from "vitest";
import {
  ChatRequestSchema,
  CreateProjectRequestSchema,
  MAX_KNOWLEDGE_FILE_BYTES,
  PasteKnowledgeRequestSchema,
  UpdateProjectConfigRequestSchema,
  UploadUrlRequestSchema,
  WidgetConfigRequestSchema,
} from "./index";

const validChat = {
  key: "pk_abc123",
  visitorId: "visitor-1",
  message: "Bonjour",
};

describe("ChatRequestSchema", () => {
  it("accepte un message valide, avec ou sans conversationId", () => {
    expect(ChatRequestSchema.safeParse(validChat).success).toBe(true);
    expect(
      ChatRequestSchema.safeParse({ ...validChat, conversationId: "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71" }).success,
    ).toBe(true);
  });

  it("refuse un message vide ou fait d'espaces", () => {
    expect(ChatRequestSchema.safeParse({ ...validChat, message: "" }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...validChat, message: "   " }).success).toBe(false);
  });

  it("accepte 1 000 caractères, refuse 1 001", () => {
    expect(ChatRequestSchema.safeParse({ ...validChat, message: "a".repeat(1000) }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...validChat, message: "a".repeat(1001) }).success).toBe(false);
  });

  it("refuse une clé sans préfixe pk_ et un conversationId non UUID", () => {
    expect(ChatRequestSchema.safeParse({ ...validChat, key: "abc" }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...validChat, conversationId: "1" }).success).toBe(false);
  });
});

describe("WidgetConfigRequestSchema", () => {
  it("exige une clé publique", () => {
    expect(WidgetConfigRequestSchema.safeParse({ key: "pk_abc" }).success).toBe(true);
    expect(WidgetConfigRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("UpdateProjectConfigRequestSchema", () => {
  it("accepte une mise à jour partielle, refuse un objet vide", () => {
    expect(UpdateProjectConfigRequestSchema.safeParse({ label: "Aide" }).success).toBe(true);
    expect(UpdateProjectConfigRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("CreateProjectRequestSchema", () => {
  it("refuse un nom vide", () => {
    expect(CreateProjectRequestSchema.safeParse({ name: " " }).success).toBe(false);
    expect(CreateProjectRequestSchema.safeParse({ name: "Mon site" }).success).toBe(true);
  });
});

describe("connaissances", () => {
  it("upload-url refuse un type non autorisé et un fichier trop gros", () => {
    const base = { title: "Doc", filename: "a.pdf", type: "pdf", sizeBytes: 1000 };
    expect(UploadUrlRequestSchema.safeParse(base).success).toBe(true);
    expect(UploadUrlRequestSchema.safeParse({ ...base, type: "exe" }).success).toBe(false);
    expect(
      UploadUrlRequestSchema.safeParse({ ...base, sizeBytes: MAX_KNOWLEDGE_FILE_BYTES + 1 }).success,
    ).toBe(false);
  });

  it("texte collé : titre et contenu requis", () => {
    expect(PasteKnowledgeRequestSchema.safeParse({ title: "T", content: "x" }).success).toBe(true);
    expect(PasteKnowledgeRequestSchema.safeParse({ title: "", content: "x" }).success).toBe(false);
  });
});
