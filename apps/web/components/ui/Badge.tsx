import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-glass-border bg-surface px-2.5 py-0.5 text-xs font-medium text-fg",
        className,
      )}
      {...props}
    />
  );
}
