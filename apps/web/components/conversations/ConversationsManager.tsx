"use client";

import type { ConversationSummary, ConversationThreadResponse } from "@askwell/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConversations, fetchThread, type FetchLike } from "../../lib/conversations-ui/conversations-api";
import { EmptyState, ErrorState, LoadingState } from "../states";
import { Button, GlassPanel } from "../ui";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; conversations: ConversationSummary[] };

type ThreadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; thread: ConversationThreadResponse };

type Props = {
  projectId: string;
  fetcher?: FetchLike;
  /** Pour les tests de rendu statique (les effets ne s'exécutent pas côté serveur). */
  initialList?: ListState;
  initialSelectedId?: string | null;
  initialThread?: ThreadState;
  timeZone?: string;
};

export function ConversationsManager({
  projectId,
  fetcher,
  initialList = { status: "loading" },
  initialSelectedId = null,
  initialThread = { status: "idle" },
  timeZone,
}: Props) {
  const [list, setList] = useState<ListState>(initialList);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [thread, setThread] = useState<ThreadState>(initialThread);
  const refreshing = list.status === "loading";
  // Ignore une réponse arrivée après une action plus récente (clic rapide, actualisation).
  const threadRequest = useRef(0);
  const send = useRef<FetchLike>(fetcher ?? ((input, init) => fetch(input, init)));

  const loadThread = useCallback(async (id: string) => {
    const request = ++threadRequest.current;
    setThread({ status: "loading" });
    const result = await fetchThread(send.current, id);
    if (request !== threadRequest.current) return;
    setThread(result.ok ? { status: "ready", thread: result.data } : { status: "error", message: result.message });
  }, []);

  const loadList = useCallback(async () => {
    const result = await fetchConversations(send.current, projectId);
    setList(result.ok ? { status: "ready", conversations: result.data } : { status: "error", message: result.message });
  }, [projectId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function select(id: string) {
    setSelectedId(id);
    void loadThread(id);
  }

  function refresh() {
    setList({ status: "loading" });
    void loadList();
    if (selectedId) void loadThread(selectedId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <Button variant="secondary" loading={refreshing} onClick={refresh}>
          Actualiser
        </Button>
      </div>
      {list.status === "loading" ? (
        <LoadingState title="Chargement des conversations…" />
      ) : list.status === "error" ? (
        <ErrorState
          text={list.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Réessayer
            </Button>
          }
        />
      ) : list.conversations.length === 0 ? (
        <EmptyState
          title="Aucune conversation pour l'instant"
          text="Les échanges de vos visiteurs avec le widget apparaîtront ici. Cliquez sur « Actualiser » pour voir les nouveaux."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ConversationList
            conversations={list.conversations}
            selectedId={selectedId}
            onSelect={select}
            timeZone={timeZone}
          />
          <GlassPanel className="min-w-0 self-start">
            {thread.status === "idle" ? (
              <p className="text-sm text-muted">Choisissez une conversation pour afficher son fil.</p>
            ) : thread.status === "loading" ? (
              <LoadingState title="Chargement du fil…" />
            ) : thread.status === "error" ? (
              <ErrorState text={thread.message} />
            ) : (
              <ConversationThread messages={thread.thread.messages} timeZone={timeZone} />
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
