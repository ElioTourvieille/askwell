import type { ReactNode } from "react";
import { StateShell } from "./StateShell";

type Props = { title?: string; text?: string; action?: ReactNode };

export function EmptyState({
  title = "Rien à afficher pour le moment",
  text = "Les éléments apparaîtront ici dès qu'il y en aura.",
  action,
}: Props) {
  return <StateShell title={title} text={text} action={action} />;
}
