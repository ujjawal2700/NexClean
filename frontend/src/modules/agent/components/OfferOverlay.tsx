import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, User, Sparkles, Check, X, Clock, Navigation, Car, Wallet, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { formatDate, formatMoney } from "@shared/lib/format";
import type { AgentDispatch } from "../hooks/useAgentDispatch";

/** Full-screen incoming-offer popup with a live countdown (Uber/food-delivery style). */
export function OfferOverlay({ dispatch }: { dispatch: AgentDispatch }) {
  const { offer, accept, decline, accepting } = dispatch;

  const content = (
    <AnimatePresence>
      {offer && (
        <OfferCard
          key={offer.bookingId}
          dispatch={dispatch}
          accept={accept}
          decline={decline}
          accepting={accepting}
        />
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

function OfferCard({
  dispatch,
  accept,
  decline,
  accepting,
}: {
  dispatch: AgentDispatch;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  accepting: boolean;
}) {
  const offer = dispatch.offer!;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keepFocus);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  // Total window captured once so the ring animates smoothly from full → empty.
  const totalMs = useRef(Math.max(1000, new Date(offer.expiresAt).getTime() - Date.now()));
  const [msLeft, setMsLeft] = useState(() => new Date(offer.expiresAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setMsLeft(new Date(offer.expiresAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [offer.expiresAt]);

  const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const fraction = Math.max(0, Math.min(1, msLeft / totalMs.current));
  const expired = msLeft <= 0;

  const R = 26;
  const C = 2 * Math.PI * R;

  const addressParts = [...new Set([offer.addressLabel, offer.addressLine].map((part) => part?.trim()).filter(Boolean))];

  return (
    <motion.div
      className="safe-modal-overlay fixed inset-0 z-[9999] flex items-end justify-center bg-ink/60 backdrop-blur-md sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-offer-title"
        tabIndex={-1}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl outline-none"
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        <div className="shrink-0 space-y-3 border-b border-line bg-primary/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-[max(0.875rem,14px)] font-medium text-primary">
                <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/30 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                Incoming job
              </p>
              <h2 id="incoming-offer-title" className="font-display text-[max(1.375rem,22px)] font-semibold leading-tight text-ink">New wash request</h2>
            </div>
            <div className="relative grid size-[64px] shrink-0 place-items-center text-primary" aria-label={`${secondsLeft} seconds left to respond`}>
              <svg className="absolute -rotate-90" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r={R} fill="none"
                  stroke={secondsLeft <= 10 ? "var(--color-amber-600)" : "currentColor"}
                  strokeWidth="4" strokeLinecap="round" strokeDasharray={C}
                  strokeDashoffset={C * (1 - fraction)}
                  style={{ transition: "stroke-dashoffset 0.2s linear" }}
                />
              </svg>
              <span className="text-center leading-none" aria-hidden="true">
                <span className="block font-display text-[max(1.25rem,20px)] font-bold tabular-nums">{secondsLeft}</span>
                <span className="mt-1 block text-[12px] font-medium">sec left</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-emerald-600/15 bg-surface px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-[max(0.875rem,14px)] font-medium text-emerald-700">
              <Wallet className="size-5 shrink-0" aria-hidden="true" /> Your payout
            </span>
            <span className="font-display text-[max(1.75rem,28px)] font-bold leading-tight text-emerald-700 [overflow-wrap:anywhere]">{formatMoney(offer.payout)}</span>
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5" data-lenis-prevent>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><User className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-[max(0.875rem,14px)] leading-relaxed text-ink-soft">Customer</p>
              <p className="text-[max(1.125rem,18px)] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{offer.customerName}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-muted/40 p-4">
            <div className="flex items-start gap-2">
              <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[max(0.875rem,14px)] font-medium leading-relaxed text-ink-soft">Service location</p>
                <div className="mt-1 text-[max(1rem,16px)] leading-relaxed text-ink [overflow-wrap:anywhere]">
                  {addressParts.map((part) => <p key={part}>{part}</p>)}
                </div>
              </div>
            </div>
            {offer.distanceKm != null && (
              <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[max(0.875rem,14px)] font-medium text-primary">
                <Navigation className="size-4 shrink-0" aria-hidden="true" /> {offer.distanceKm} km away
              </p>
            )}
          </div>
          <div className="space-y-3 text-[max(1rem,16px)] leading-relaxed text-ink">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[max(0.875rem,14px)] text-ink-soft">Wash type</p>
                <p className="font-semibold [overflow-wrap:anywhere]">{offer.packageName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Car className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 [overflow-wrap:anywhere]">{offer.vehicleName}</p>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 [overflow-wrap:anywhere]">{formatDate(offer.date)} · {offer.slot}</p>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[1fr_1.4fr] gap-2 border-t border-line bg-surface p-4 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] sm:gap-3 sm:p-5">
          <Button variant="outline" className="h-auto min-h-[52px] min-w-0 cursor-pointer gap-1.5 px-2 py-3 text-[max(1rem,16px)]" onClick={decline} disabled={accepting}>
            <X className="size-5 shrink-0" aria-hidden="true" /> Decline
          </Button>
          <Button
            className="h-auto min-h-[52px] min-w-0 cursor-pointer gap-1.5 bg-emerald-600 bg-none px-2 py-3 text-[max(1rem,16px)] shadow-none hover:bg-emerald-700 hover:shadow-none"
            onClick={accept}
            disabled={accepting || expired}
            aria-busy={accepting}
          >
            {accepting ? <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : <Check className="size-5 shrink-0" aria-hidden="true" />}
            {expired ? "Expired" : accepting ? "Accepting…" : "Accept job"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
