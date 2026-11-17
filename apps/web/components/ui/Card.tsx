import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type CardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
};

export function Card({ title, description, className, children, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-glass border border-glass-border bg-glass p-5 text-fg shadow-glass backdrop-blur-(--blur-glass)",
        className,
      )}
      {...props}
    >
      {title ? <h3 className="text-lg font-semibold break-words">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm text-muted break-words">{description}</p> : null}
      {children ? <div className={title || description ? "mt-4" : undefined}>{children}</div> : null}
    </div>
  );
}
