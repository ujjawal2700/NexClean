import { useEffect, useRef } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { useScrollLock } from "@shared/lib/scrollLock";

/**
 * Blocking "this booking was cancelled" notice. Shown the moment a cancellation
 * lands over the socket (or is picked up by reconciliation), so neither the
 * customer nor the cleaner keeps looking at a job that no longer exists. OK is
 * the only way out, and the caller sends them somewhere useful from there.
 */
export function BookingCancelledDialog({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useScrollLock();

  useEffect(() => {
    buttonRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => document.removeEventListener("keydown", keepFocusInside);
  }, []);

  return (
    <div
      className="safe-modal-overlay fixed inset-0 z-[130] flex items-center justify-center bg-ink/60 backdrop-blur-sm"
      role="presentation"
      data-testid="booking-cancelled-dialog"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="booking-cancelled-title"
        aria-describedby="booking-cancelled-description"
        className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-[28px] border border-line bg-surface p-6 text-center shadow-2xl sm:p-8"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-red-500/10 text-red-600">
          <XCircle className="size-9" />
        </div>
        <h2 id="booking-cancelled-title" className="mt-5 font-display text-2xl font-semibold text-ink">
          {title}
        </h2>
        <p id="booking-cancelled-description" className="mt-2 text-sm leading-6 text-muted">
          {description}
        </p>
        <Button ref={buttonRef} onClick={onConfirm} className="mt-6 min-h-12 w-full text-base">
          OK
        </Button>
      </section>
    </div>
  );
}
