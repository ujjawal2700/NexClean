import { Check } from "lucide-react";
import { cn } from "@shared/lib/utils";

export const STEP_LABELS = ["Vehicle", "Package", "Schedule", "Address", "Payment"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1 last:flex-none sm:gap-2">
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors sm:size-8 sm:text-sm",
                  done && "bg-primary text-white",
                  active && "bg-primary/10 text-primary ring-2 ring-primary/30",
                  !done && !active && "bg-surface-muted text-muted",
                )}
              >
                {done ? <Check className="size-3.5 sm:size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-ink" : "text-muted",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span
                className={cn(
                  "h-0.5 min-w-0 flex-1 rounded-full transition-colors",
                  done ? "bg-primary" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
