import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@shared/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  /** icon or element rendered at the left inside the field */
  leading?: ReactNode;
};

/**
 * Themed text input with optional label, leading element, hint and error.
 * Reused across all forms (auth, address, profile) in every module.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leading, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-2xl border bg-surface px-4 transition-colors",
            "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
            error ? "border-red-400" : "border-line",
          )}
        >
          {leading && <span className="text-muted">{leading}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-12 w-full bg-transparent text-ink outline-none placeholder:text-muted/70",
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        ) : (
          hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
