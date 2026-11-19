"use client";

import type { KnowledgeSource } from "@askwell/shared";
import { useState } from "react";
import { statusLabel, typeLabel } from "../../lib/knowledge-ui/format";
import { formatCreatedAt } from "../../lib/projects-ui/format";
import { Badge, Button, Card } from "../ui";

type Props = {
  source: KnowledgeSource;
  /** Retourne `null` en cas de succès, sinon le message d'erreur. */
  onDelete: (id: string) => Promise<string | null>;
  /** Pour les tests de rendu statique. */
  initialConfirming?: boolean;
  initialError?: string | null;
};

/** Le titre est rendu comme texte par React : jamais interprété comme du HTML. */
export function KnowledgeItem({ source, onDelete, initialConfirming = false, initialError = null }: Props) {
  const [confirming, setConfirming] = useState(initialConfirming);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    if (pending) return;
    setPending(true);
    const message = await onDelete(source.id);
    setPending(false);
    // En cas de succès, la ligne disparaît de la liste : rien d'autre à faire.
    if (message !== null) setError(message);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-lg font-semibold break-words">{source.title}</h3>
          <Badge>{statusLabel(source.status)}</Badge>
        </div>
        <p className="text-sm text-muted">
          {typeLabel(source.type)} · ajoutée le {formatCreatedAt(source.createdAt)}
        </p>
        {confirming ? (
          <div role="alertdialog" aria-label="Confirmer la suppression" className="flex flex-col gap-3">
            <p className="text-sm break-words">
              Supprimer « {source.title} » ? Son fichier et ses extraits seront supprimés. Cette action est définitive.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button loading={pending} onClick={confirmDelete}>
                Supprimer définitivement
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              Supprimer
            </Button>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
