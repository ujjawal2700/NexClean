import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Phone, UserPlus, X } from "lucide-react";
import { Button } from "@shared/ui/Button";

type Audience = "customer" | "agent";

type AccountNotFoundDialogProps = {
  phone: string;
  onClose: () => void;
  onSignUp: () => void;
  /** Which app is asking — decides the wording. Defaults to the customer app. */
  audience?: Audience;
};

const COPY: Record<Audience, { eyebrow: string; body: string; cta: string }> = {
  customer: {
    eyebrow: "New to NexClean?",
    body: "We couldn't find a customer account connected to this mobile number. Create one to start booking doorstep car care.",
    cta: "Create my account",
  },
  agent: {
    eyebrow: "New to NexClean?",
    body: "We couldn't find an agent account connected to this mobile number. Apply to join as a cleaning specialist and start taking jobs.",
    cta: "Apply to join",
  },
};

/** Focused recovery dialog shown when a login number has no account. */
export function AccountNotFoundDialog({ phone, onClose, onSignUp, audience = "customer" }: AccountNotFoundDialogProps) {
  const copy = COPY[audience];
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const formattedPhone = phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;

  useEffect(() => {
    const appRoot = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden");
    const wasInert = appRoot?.inert ?? false;

    document.body.style.overflow = "hidden";
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }

    const focusFrame = window.requestAnimationFrame(() => primaryActionRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = wasInert;
        if (previousAriaHidden == null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-slate-950/65 px-3 pt-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-testid="account-not-found-dialog"
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-line bg-surface shadow-2xl outline-none sm:rounded-[2rem]"
      >
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-primary via-primary-soft to-accent" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account not found dialog"
          className="absolute right-4 top-5 grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X className="size-5" />
        </button>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-3 pt-7 text-center sm:px-8 sm:pt-8" data-lenis-prevent>
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
            <UserPlus className="size-8" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
          <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
            Your account was not found
          </h2>
          <p id={descriptionId} className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted sm:text-base">
            {copy.body}
          </p>

          <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-line bg-surface-muted/60 px-4 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-primary shadow-sm">
              <Phone className="size-4" aria-hidden="true" />
            </span>
            <div className="text-left">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Mobile number</p>
              <p className="font-display text-base font-semibold text-ink">+91 {formattedPhone}</p>
            </div>
          </div>
        </div>

        <div className="account-dialog-actions shrink-0 space-y-3 border-t border-line/70 bg-surface-muted/35 px-6 pt-5 sm:px-8">
          <Button ref={primaryActionRef} type="button" size="lg" className="h-[56px] w-full text-base" onClick={onSignUp}>
            {copy.cta} <ArrowRight className="size-5" />
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-[56px] w-full text-base" onClick={onClose}>
            Use another number
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted">
            Signup is quick, and we'll carry this number into the form for you.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
