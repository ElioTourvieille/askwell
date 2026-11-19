"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "../ui";

type Props = {
  /** Retourne `null` si la création a réussi, sinon le message d'erreur à afficher. */
  onCreate: (name: string) => Promise<string | null>;
  /** Message initial (utilisé aussi pour le rendu statique des tests). */
  initialError?: string | null;
};

export function CreateProjectForm({ onCreate, initialError = null }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const message = await onCreate(name);
    setPending(false);
    setError(message);
    if (message === null) setName("");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <Input
          label="Nom du projet"
          name="name"
          value={name}
          maxLength={100}
          placeholder="Mon site"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} className="sm:mt-[1.625rem]">
        Créer le projet
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
