import type { ReactNode } from "react";
import { GlassPanel } from "../ui/GlassPanel";

type StateShellProps = {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
  role?: "status" | "alert";
};

/** Structure commune des trois états : titre, texte, action facultative. */
export function StateShell({ title, text, action, icon, role = "status" }: StateShellProps) {
  return (
    <GlassPanel role={role} className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
      {icon}
      <h2 className="text-lg font-semibold break-words">{title}</h2>
      {text ? <p className="text-sm text-muted break-words">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </GlassPanel>
  );
}
