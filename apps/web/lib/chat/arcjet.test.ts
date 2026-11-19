import { CHAT_RATE_LIMIT_PER_MINUTE } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` lève hors d'un composant serveur ; ici on ne teste que la logique.
vi.mock("server-only", () => ({}));

const { protect, arcjetFactory, slidingWindow, detectPromptInjection, embedTexts, createChatCompletion } =
  vi.hoisted(() => {
    const protect = vi.fn();
    return {
      protect,
      arcjetFactory: vi.fn(() => ({ protect })),
      slidingWindow: vi.fn((options: object) => [{ type: "sliding", ...options }]),
      detectPromptInjection: vi.fn((options: object) => [{ type: "injection", ...options }]),
      embedTexts: vi.fn(),
      createChatCompletion: vi.fn(),
    };
  });

vi.mock("@arcjet/next", () => ({ default: arcjetFactory, slidingWindow, detectPromptInjection }));
// Un message bloqué ne doit jamais atteindre OpenAI : on surveille les deux appels.
vi.mock("../openai", () => ({ embedTexts, createChatCompletion }));

type FakeDecision = {
  isErrored: () => boolean;
  isDenied: () => boolean;
  reason: { isRateLimit: () => boolean; isPromptInjection: () => boolean };
};

function decision(kind: "allow" | "rate_limit" | "injection" | "error" | "other_deny"): FakeDecision {
  return {
    isErrored: () => kind === "error",
    isDenied: () => kind !== "allow" && kind !== "error",
    reason: {
      isRateLimit: () => kind === "rate_limit",
      isPromptInjection: () => kind === "injection",
    },
  };
}

const request = new Request("https://app.test/api/widget/chat", { method: "POST" });
const input = { request, publicKey: "pk_test", message: "Quels sont vos horaires ?" };

async function load() {
  vi.resetModules();
  return import("./arcjet");
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ARCJET_KEY = "ajkey_test_factice";
});

afterEach(() => {
  delete process.env.ARCJET_KEY;
});

describe("protectChatMessage", () => {
  it("laisse passer un message normal", async () => {
    protect.mockResolvedValue(decision("allow"));
    const { protectChatMessage } = await load();
    expect(await protectChatMessage(input)).toEqual({ status: "allowed" });
  });

  it("bloque avec le motif rate_limit, sans appel OpenAI", async () => {
    protect.mockResolvedValue(decision("rate_limit"));
    const { protectChatMessage } = await load();
    expect(await protectChatMessage(input)).toEqual({ status: "blocked", reason: "rate_limit" });
    expect(embedTexts).not.toHaveBeenCalled();
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("bloque avec le motif injection, sans appel OpenAI", async () => {
    protect.mockResolvedValue(decision("injection"));
    const { protectChatMessage } = await load();
    expect(await protectChatMessage(input)).toEqual({ status: "blocked", reason: "injection" });
    expect(embedTexts).not.toHaveBeenCalled();
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("refuse (échec fermé) quand Arcjet n'a pas pu décider", async () => {
    protect.mockResolvedValue(decision("error"));
    const { protectChatMessage } = await load();
    expect(await protectChatMessage(input)).toEqual({ status: "blocked", reason: "unavailable" });
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("refuse aussi un refus d'une autre origine", async () => {
    protect.mockResolvedValue(decision("other_deny"));
    const { protectChatMessage } = await load();
    expect(await protectChatMessage(input)).toEqual({ status: "blocked", reason: "unavailable" });
  });

  it("transmet la requête, la clé publique et le message à Arcjet, en un seul appel", async () => {
    protect.mockResolvedValue(decision("allow"));
    const { protectChatMessage } = await load();
    await protectChatMessage(input);
    expect(protect).toHaveBeenCalledTimes(1);
    expect(protect).toHaveBeenCalledWith(request, {
      publicKey: "pk_test",
      detectPromptInjectionMessage: "Quels sont vos horaires ?",
    });
  });
});

describe("client Arcjet", () => {
  it("n'est pas créé à l'import, seulement au premier message, puis réutilisé", async () => {
    protect.mockResolvedValue(decision("allow"));
    const { protectChatMessage } = await load();
    expect(arcjetFactory).not.toHaveBeenCalled();
    await protectChatMessage(input);
    await protectChatMessage(input);
    expect(arcjetFactory).toHaveBeenCalledTimes(1);
  });

  it("limite à 20 messages par minute par adresse IP et clé publique, en mode LIVE", async () => {
    protect.mockResolvedValue(decision("allow"));
    const { protectChatMessage } = await load();
    await protectChatMessage(input);

    expect(CHAT_RATE_LIMIT_PER_MINUTE).toBe(20);
    expect(slidingWindow).toHaveBeenCalledWith({ mode: "LIVE", interval: "1m", max: CHAT_RATE_LIMIT_PER_MINUTE });
    expect(detectPromptInjection).toHaveBeenCalledWith({ mode: "LIVE" });
    expect(arcjetFactory).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ajkey_test_factice", characteristics: ["ip.src", "publicKey"] }),
    );
  });

  it("lève une erreur claire, sans la valeur, quand ARCJET_KEY manque", async () => {
    delete process.env.ARCJET_KEY;
    const { protectChatMessage } = await load();
    await expect(protectChatMessage(input)).rejects.toThrow(/ARCJET_KEY est absente/);
    expect(protect).not.toHaveBeenCalled();
  });
});
