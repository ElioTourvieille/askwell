"use client";

import { MAX_KNOWLEDGE_TEXT_LENGTH } from "@askwell/shared";
import { useId, useState, type FormEvent } from "react";
import { Button, Input } from "../ui";

type Props = {
  /** Retourne `null` si l'ajout a réussi, sinon le message d'erreur à afficher. */
  onSubmit: (title: string, content: string) => Promise<string | null>;
  /** Message initial (utilisé aussi pour le rendu statique des tests). */
  initialError?: string | null;
};

export function PasteKnowledgeForm({ onSubmit, initialError = null }: Props) {
  const contentId = useId();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const message = await onSubmit(title, content);
    setPending(false);
    setError(message);
    if (message === null) {
      setTitle("");
      setContent("");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Coller du texte" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Coller du texte</h2>
      <Input label="Titre" name="title" value={title} maxLength={200} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={contentId} className="text-sm font-medium">
          Contenu
        </label>
        <textarea
          id={contentId}
          name="content"
          value={content}
          maxLength={MAX_KNOWLEDGE_TEXT_LENGTH}
          rows={6}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-w-0 rounded-control border border-glass-border bg-glass px-3.5 py-2.5 text-base text-fg backdrop-blur-(--blur-glass) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Ajouter le texte
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
