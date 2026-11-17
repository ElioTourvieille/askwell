import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg border border-transparent hover:opacity-90",
  secondary: "bg-glass text-fg border border-glass-border backdrop-blur-(--blur-glass) hover:bg-surface",
  ghost: "bg-transparent text-fg border border-transparent hover:bg-surface",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex min-h-touch items-center justify-center gap-2 rounded-control px-5 text-sm font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="motion-safe-anim size-4 animate-[askwell-spin_0.8s_linear_infinite] rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
