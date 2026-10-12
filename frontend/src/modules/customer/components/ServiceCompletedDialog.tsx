import { useEffect, useRef } from "react";
import { CheckCircle2, Sparkles, Star } from "lucide-react";
import { Button } from "@shared/ui/Button";

/**
 * Shown the moment a service completes: confirms it, and asks the customer to
 * rate the specialist. Tapping a star (or "Rate now") opens the booking's
 * detail page with the rating form; "Maybe later" just closes it.
 */
export function ServiceCompletedDialog({
  agentName,
  onRate,
  onLater,
}: {
  agentName?: string | null;
  onRate: (stars?: number) => void;
  onLater: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const rateRef = useRef<HTMLButtonElement>(null);
  const who = agentName?.trim() ? agentName.trim().split(/\s+/)[0] : "your specialist";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rateRef.current?.focus();

    // Keep Tab cycling inside the dialog.
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !sectionRef.current) return;
      const focusable = Array.from(sectionRef.current.querySelectorAll<HTMLElement>("button"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="safe-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-ink/60 backdrop-blur-sm"
      role="presentation"
      data-testid="service-completed-dialog"
    >
      <section
        ref={sectionRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="service-completed-title"
        aria-describedby="service-completed-description"
        className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-[28px] border border-line bg-surface p-6 text-center shadow-2xl sm:p-8"
      >
        <div className="relative mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-9" />
          <Sparkles className="absolute -right-1 -top-1 size-5 text-amber-500" />
        </div>
        <h2 id="service-completed-title" className="mt-5 font-display text-2xl font-semibold text-ink">
          Your service is complete
        </h2>
        <p id="service-completed-description" className="mt-2 text-sm leading-6 text-muted">
          Your vehicle is sparkling clean! Please rate {who} — it takes a few seconds and helps us keep every wash
          great.
        </p>

        <div className="mt-5 flex justify-center gap-1.5" role="group" aria-label={`Rate ${who}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRate(n)}
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
              className="group cursor-pointer rounded-lg p-0.5 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Star className="size-9 text-amber-400 transition-colors group-hover:fill-amber-400" />
            </button>
          ))}
        </div>

        <Button ref={rateRef} onClick={() => onRate()} className="mt-6 min-h-12 w-full text-base">
          <Star className="size-4 fill-current" /> Rate now
        </Button>
        <Button variant="ghost" onClick={onLater} className="mt-2 min-h-11 w-full">
          Maybe later
        </Button>
      </section>
    </div>
  );
}
