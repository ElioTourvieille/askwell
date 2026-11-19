"use client";

import { MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Input } from "../ui";

type Props = {
  /** Retourne `null` si l'envoi a réussi, sinon le message d'erreur à afficher. */
  onSubmit: (title: string, file: File) => Promise<string | null>;
  /** Message initial (utilisé aussi pour le rendu statique des tests). */
  initialError?: string | null;
};

const MAX_MB = MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024);

export function UploadKnowledgeForm({ onSubmit, initialError = null }: Props) {
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choisissez un fichier.");
      return;
    }
    setPending(true);
    const message = await onSubmit(title, file);
    setPending(false);
    setError(message);
    if (message === null) {
      setTitle("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Téléverser un fichier" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Téléverser un fichier</h2>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={fileId} className="text-sm font-medium">
          Fichier (PDF, MD ou TXT, {MAX_MB} Mo maximum)
        </label>
        <input
          ref={fileInput}
          id={fileId}
          name="file"
          type="file"
          accept=".pdf,.md,.txt"
          className="min-h-touch w-full min-w-0 text-sm"
        />
      </div>
      <Input
        label="Titre (facultatif : le nom du fichier par défaut)"
        name="title"
        value={title}
        maxLength={200}
        autoComplete="off"
        onChange={(e) => setTitle(e.target.value)}
      />
      <div>
        <Button type="submit" loading={pending}>
          Téléverser
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
