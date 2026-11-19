"use client";

import type { KnowledgeSource } from "@askwell/shared";
import { useState } from "react";
import { deleteSource, submitFile, submitPaste, type FetchLike } from "../../lib/knowledge-ui/knowledge-api";
import { EmptyState } from "../states";
import { Button, GlassPanel } from "../ui";
import { KnowledgeItem } from "./KnowledgeItem";
import { PasteKnowledgeForm } from "./PasteKnowledgeForm";
import { UploadKnowledgeForm } from "./UploadKnowledgeForm";

type Props = {
  projectId: string;
  initialSources: KnowledgeSource[];
  fetcher?: FetchLike;
  /** Actualisation manuelle (pas de temps réel, project.md §12). Par défaut : recharge la page. */
  onRefresh?: () => void;
};

export function KnowledgeManager({ projectId, initialSources, fetcher, onRefresh }: Props) {
  const [sources, setSources] = useState(initialSources);
  const send: FetchLike = fetcher ?? ((input, init) => fetch(input, init));

  function addSource(source: KnowledgeSource) {
    setSources((current) => [source, ...current.filter((s) => s.id !== source.id)]);
  }

  async function paste(title: string, content: string): Promise<string | null> {
    const result = await submitPaste(send, projectId, title, content);
    if (!result.ok) return result.message;
    addSource(result.source);
    return null;
  }

  async function upload(title: string, file: File): Promise<string | null> {
    const result = await submitFile(send, projectId, title, file);
    if (!result.ok) return result.message;
    addSource(result.source);
    return null;
  }

  async function remove(id: string): Promise<string | null> {
    const result = await deleteSource(send, id);
    if (!result.ok) return result.message;
    setSources((current) => current.filter((s) => s.id !== id));
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel>
          <PasteKnowledgeForm onSubmit={paste} />
        </GlassPanel>
        <GlassPanel>
          <UploadKnowledgeForm onSubmit={upload} />
        </GlassPanel>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sources</h2>
        <Button variant="secondary" onClick={onRefresh ?? (() => window.location.reload())}>
          Actualiser
        </Button>
      </div>
      {sources.length === 0 ? (
        <EmptyState
          title="Aucune source pour l'instant"
          text="Collez un texte ou téléversez un fichier pour que votre assistant puisse répondre à partir de vos contenus."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {sources.map((source) => (
            <li key={source.id}>
              <KnowledgeItem source={source} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
