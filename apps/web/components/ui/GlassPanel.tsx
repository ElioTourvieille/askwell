import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-glass border border-glass-border bg-glass p-6 text-fg shadow-glass backdrop-blur-(--blur-glass)",
        className,
      )}
      {...props}
    />
  );
}
