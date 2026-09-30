import { useEffect, useRef } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@shared/ui/Button";

export function ServiceCompletedDialog({ onConfirm }: { onConfirm: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        buttonRef.current?.focus();
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="presentation"
      data-testid="service-completed-dialog"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="service-completed-title"
        aria-describedby="service-completed-description"
        className="w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 text-center shadow-2xl sm:p-8"
      >
        <div className="relative mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-9" />
          <Sparkles className="absolute -right-1 -top-1 size-5 text-amber-500" />
        </div>
        <h2 id="service-completed-title" className="mt-5 font-display text-2xl font-semibold text-ink">
          Your service is completed
        </h2>
        <p id="service-completed-description" className="mt-2 text-sm leading-6 text-muted">
          Your vehicle service has been completed successfully. You can review the booking and service photos from your booking history.
        </p>
        <Button ref={buttonRef} onClick={onConfirm} className="mt-6 min-h-12 w-full text-base">
          OK
        </Button>
      </section>
    </div>
  );
}
