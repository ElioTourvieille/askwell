import type { ReactNode } from "react";
import { Skeleton } from "../ui/Skeleton";
import { StateShell } from "./StateShell";

type Props = { title?: string; text?: string; action?: ReactNode };

export function LoadingState({ title = "Chargement…", text, action }: Props) {
  return (
    <StateShell
      title={title}
      text={text}
      action={action}
      icon={
        <div className="flex w-full flex-col gap-2" aria-hidden="true">
          <Skeleton className="mx-auto w-2/3" />
          <Skeleton className="mx-auto w-1/2" />
        </div>
      }
    />
  );
}
