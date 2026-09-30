import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { LogOut, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@shared/ui/Button";

type LogoutAudience = "customer" | "agent" | "admin";

const SUPPORTING_COPY: Record<LogoutAudience, string> = {
  customer: "Your bookings, wallet and saved details will stay here for your next visit.",
  agent: "You’ll stop receiving live job updates on this device until you sign in again.",
  admin: "The admin console will be locked on this device until you sign in again.",
};

export function LogoutConfirmDialog({
  open,
  audience,
  onClose,
  onConfirm,
}: {
  open: boolean;
  audience: LogoutAudience;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}>
          <button
            type="button"
            aria-label="Close logout confirmation"
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
            onClick={onClose}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            data-testid={`${audience}-logout-dialog`}
            initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="relative max-h-[calc(100dvh-0.75rem)] w-full overflow-y-auto rounded-t-[2rem] border border-line/80 bg-surface/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:max-w-md sm:rounded-[2rem] sm:p-6 sm:shadow-[var(--shadow-lift)]">
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-line sm:hidden" />

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-line/70 bg-surface-muted/70 text-muted transition-colors hover:text-ink sm:right-5 sm:top-5">
              <X className="size-4" />
            </button>

            <span className="grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <LogOut className="size-5" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Secure sign out
            </p>
            <h2 id={titleId} className="mt-1 pr-10 font-display text-2xl font-semibold text-ink">
              Log out of NexClean?
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">
              This will end your current {audience} session on this device.
            </p>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line/80 bg-surface-muted/55 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="size-4" />
              </span>
              <p className="text-sm leading-5 text-ink-soft">{SUPPORTING_COPY[audience]}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onClose} autoFocus className="w-full px-3">
                Stay signed in
              </Button>
              <Button
                onClick={onConfirm}
                className="w-full bg-ink px-3 text-surface shadow-none hover:bg-ink/90 hover:shadow-none">
                <LogOut className="size-4" /> Log out
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
