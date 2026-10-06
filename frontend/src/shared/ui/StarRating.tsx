import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@shared/lib/utils";

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/**
 * Read-only stars for a rating, including halves of an average (4.6 → four
 * full stars and a 60% fifth).
 */
export function StarDisplay({
  value,
  size = "size-4",
  className,
}: {
  value: number;
  size?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn("relative inline-block", size)} aria-hidden>
            <Star className={cn("absolute inset-0 text-amber-400/35", size)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-amber-400 text-amber-400", size)} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Tappable 1–5 star picker, as a radio group for screen readers and keyboards. */
export function StarInput({
  value,
  onChange,
  size = "size-9",
  disabled,
  label = "Your rating",
}: {
  value: number;
  onChange: (stars: number) => void;
  size?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""} — ${RATING_LABELS[i]}`}
          disabled={disabled}
          onMouseEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(5, (value || 0) + 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(1, (value || 1) - 1));
            }
          }}
          className="cursor-pointer rounded-lg p-0.5 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:hover:scale-100">
          <Star
            className={cn(
              size,
              "transition-colors",
              i <= shown ? "fill-amber-400 text-amber-400" : "text-line",
            )}
          />
        </button>
      ))}
    </div>
  );
}
