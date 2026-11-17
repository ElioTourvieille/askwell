import type { ReactNode } from "react";
import { StateShell } from "./StateShell";

type Props = { title?: string; text?: string; action?: ReactNode };

export function ErrorState({
  title = "Une erreur est survenue",
  text = "Impossible de charger les données. Réessayez dans un instant.",
  action,
}: Props) {
  return <StateShell title={title} text={text} action={action} role="alert" />;
}
