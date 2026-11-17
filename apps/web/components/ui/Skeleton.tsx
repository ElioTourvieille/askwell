import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "motion-safe-anim h-4 w-full animate-[askwell-pulse_1.6s_ease-in-out_infinite] rounded-control bg-surface",
        className,
      )}
      {...props}
    />
  );
}
