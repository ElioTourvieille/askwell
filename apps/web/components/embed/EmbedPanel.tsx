"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME, MAX_MESSAGE_LENGTH, type WidgetConfig } from "@askwell/shared";
import { fakeReply } from "../../lib/embed/fake-reply";
import { QuotaReachedError } from "../../lib/embed/errors";
import { postToParent } from "../../lib/embed/parent";
import { getVisitorId } from "../../lib/embed/visitor-id";
import { EmptyState, ErrorState } from "../states";
import { Button } from "../ui";
import { MessageList, type ChatMessage } from "./MessageList";
import { QuotaNotice } from "./QuotaNotice";

type Props = { config: WidgetConfig; parentOrigin: string | null };
type Status = "idle" | "typing" | "error" | "quota";

export function EmbedPanel({ config, parentOrigin }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [lastSent, setLastSent] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const visitorIdRef = useRef<string | null>(null);

  const send = useCallback(
    (to: Parameters<typeof postToParent>[1]) => postToParent(parentOrigin, to),
    [parentOrigin],
  );

  // Identifiant du visiteur (localStorage protégé, repli en mémoire) — utilisé par la route de chat en phase 3.
  useEffect(() => {
    visitorIdRef.current = getVisitorId();
  }, []);

  // Panneau caché (iframe fermée) → les réponses comptent comme non lues ; visible → remise à zéro.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.getClientRects().length > 0 && unreadRef.current !== 0) {
        unreadRef.current = 0;
        send({ source: "askwell", type: "unread", count: 0 });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [send]);

  // Hauteur souhaitée, demandée au chargeur (qui la borne).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    send({ source: "askwell", type: "resize", height: list.scrollHeight + 160 });
  }, [messages, status, send]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status]);

  async function deliver(message: string) {
    setStatus("typing");
    try {
      const reply = await fakeReply(message);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "bot", text: reply }]);
      setStatus("idle");
      if (rootRef.current && rootRef.current.getClientRects().length === 0) {
        unreadRef.current += 1;
        send({ source: "askwell", type: "unread", count: unreadRef.current });
      }
    } catch (error) {
      setStatus(error instanceof QuotaReachedError ? "quota" : "error");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH || status === "typing" || status === "quota") return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "visitor", text: message }]);
    setText("");
    setLastSent(message);
    void deliver(message);
  }

  const blocked = status === "typing" || status === "quota";

  return (
    <div
      ref={rootRef}
      data-theme="light"
      className="flex h-dvh w-full flex-col overflow-hidden rounded-glass border border-glass-border bg-bg text-fg"
    >
      <header className="flex items-center justify-between gap-2 border-b border-glass-border px-4 py-3">
        <h1 className="min-w-0 truncate text-base font-semibold">{config.header_text}</h1>
        {parentOrigin ? (
          <Button
            variant="ghost"
            aria-label="Fermer"
            className="min-w-touch px-2"
            onClick={() => send({ source: "askwell", type: "close" })}
          >
            ✕
          </Button>
        ) : null}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && status === "idle" ? (
          <EmptyState title="Posez votre question" text="Je réponds à partir des informations de ce site." />
        ) : (
          <MessageList messages={messages} typing={status === "typing"} accent={config.button_color} />
        )}
        {status === "quota" ? (
          <div className="mt-3">
            <QuotaNotice />
          </div>
        ) : null}
        {status === "error" ? (
          <div className="mt-3">
            <ErrorState
              title="Message non envoyé"
              text="Un problème est survenu. Réessayez dans un instant."
              action={<Button onClick={() => void deliver(lastSent)}>Réessayer</Button>}
            />
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-1 border-t border-glass-border px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            aria-label="Votre message"
            value={text}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={status === "quota"}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrivez votre message…"
            autoComplete="off"
            className="min-h-touch min-w-0 flex-1 rounded-control border border-glass-border bg-glass px-3.5 text-base text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          />
          <Button type="submit" disabled={blocked || text.trim().length === 0}>
            Envoyer
          </Button>
        </div>
        <p className="text-right text-xs text-muted" aria-live="off">
          {text.length}/{MAX_MESSAGE_LENGTH}
        </p>
        {config.show_badge ? (
          <p className="text-center text-xs text-muted">Powered by {APP_NAME}</p>
        ) : null}
      </form>
    </div>
  );
}
