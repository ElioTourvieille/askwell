import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(
          "min-h-touch w-full min-w-0 rounded-control border bg-glass px-3.5 text-base text-fg placeholder:text-muted",
          "backdrop-blur-(--blur-glass) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-danger" : "border-glass-border",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
