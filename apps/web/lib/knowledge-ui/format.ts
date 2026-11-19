import type { KnowledgeSource } from "@askwell/shared";

/** `uploading` et `processing` s'affichent tous deux « en cours de traitement » (project.md §6.4). */
export function statusLabel(status: KnowledgeSource["status"]): string {
  switch (status) {
    case "uploading":
    case "processing":
      return "en cours de traitement";
    case "ready":
      return "prête";
    case "failed":
      return "échec du traitement";
  }
}

export function typeLabel(type: KnowledgeSource["type"]): string {
  switch (type) {
    case "text":
      return "Texte";
    case "pdf":
      return "PDF";
    case "md":
      return "Markdown";
    case "txt":
      return "Fichier texte";
  }
}
