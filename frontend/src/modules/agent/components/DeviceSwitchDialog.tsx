import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Loader2, Smartphone, ShieldAlert } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { useScrollLock } from "@shared/lib/scrollLock";

/**
 * Shown after a correct OTP when this cleaner is already signed in on another
 * phone. Only one phone may hold the account, so continuing here signs the
 * other one out — the cleaner has to say so explicitly.
 */
export function DeviceSwitchDialog({
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  useScrollLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-4" data-testid="device-switch-dialog">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]" />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full rounded-t-[2rem] border border-line/80 bg-surface/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] backdrop-blur-xl sm:max-w-md sm:rounded-[2rem] sm:p-6"
      >
        <span className="grid size-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
          <Smartphone className="size-5" />
        </span>
        <h2 id={titleId} className="mt-4 font-display text-2xl font-semibold text-ink">
          Log in on this phone?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">
          You're already logged in on another phone. If you log in here, you'll be logged out from the other phone.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line/80 bg-surface-muted/55 p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
            <ShieldAlert className="size-4" />
          </span>
          <p className="text-sm leading-5 text-ink-soft">
            Job offers and live location will only work on this phone from now on.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} disabled={pending} className="w-full px-3">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending} autoFocus className="w-full px-3" data-testid="device-switch-confirm">
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Log in here"}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
