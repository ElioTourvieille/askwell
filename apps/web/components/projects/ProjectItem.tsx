"use client";

import type { Project } from "@askwell/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatCreatedAt, formatMessagesUsed } from "../../lib/projects-ui/format";
import { Badge, Button, Card, Input } from "../ui";

type Props = {
  project: Project;
  /** Retourne `null` en cas de succès, sinon le message d'erreur. */
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  /** Pour les tests de rendu statique. */
  initialMode?: "view" | "rename" | "confirm-delete";
  initialError?: string | null;
};

const LINK_CLASS =
  "inline-flex min-h-touch items-center justify-center rounded-control border border-glass-border bg-glass px-5 text-sm font-medium text-fg backdrop-blur-(--blur-glass) hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function ProjectItem({ project, onRename, onDelete, initialMode = "view", initialError = null }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const message = await onRename(project.id, name);
    setPending(false);
    setError(message);
    if (message === null) setMode("view");
  }

  async function confirmDelete() {
    if (pending) return;
    setPending(true);
    const message = await onDelete(project.id);
    setPending(false);
    // En cas de succès, la ligne disparaît de la liste : rien d'autre à faire.
    if (message !== null) setError(message);
  }

  return (
    <Card>
      {mode === "rename" ? (
        <form onSubmit={submitRename} noValidate className="flex flex-col gap-3">
          <Input
            label="Nouveau nom"
            value={name}
            maxLength={100}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setName(project.name);
                setError(null);
                setMode("view");
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 text-lg font-semibold break-words">{project.name}</h3>
            <Badge>{formatMessagesUsed(project.messagesUsed)}</Badge>
          </div>
          <p className="text-sm text-muted">Créé le {formatCreatedAt(project.createdAt)}</p>
          {mode === "confirm-delete" ? (
            <div role="alertdialog" aria-label="Confirmer la suppression" className="flex flex-col gap-3">
              <p className="text-sm break-words">
                Supprimer « {project.name} » ? Ses connaissances et ses conversations seront supprimées. Cette action
                est définitive.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button loading={pending} onClick={confirmDelete}>
                  Supprimer définitivement
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setMode("view")}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/projects/${project.id}/install`} className={LINK_CLASS}>
                Installer
              </Link>
              <Link href={`/dashboard/projects/${project.id}/knowledge`} className={LINK_CLASS}>
                Connaissances
              </Link>
              <Link href={`/dashboard/projects/${project.id}/conversations`} className={LINK_CLASS}>
                Conversations
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setMode("rename");
                }}
              >
                Renommer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setMode("confirm-delete");
                }}
              >
                Supprimer
              </Button>
            </div>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
