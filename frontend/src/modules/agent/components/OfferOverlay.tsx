import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Navigation, Clock, MapPin, Car, Sparkles, Check, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { VEHICLE_LABEL } from "../types";
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

  const when = useMemo(
    () => new Date(offer.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    [offer.date],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 sm:p-6 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        {/* Header with countdown */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-primary to-accent px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-tight">New wash request</p>
              <p className="text-xs text-white/80">
                {offer.isSubscriptionWash ? "Subscription wash" : "On-demand booking"}
              </p>
            </div>
          </div>
          <div className="relative grid size-16 place-items-center">
            <svg className="absolute -rotate-90" width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fraction)}
                style={{ transition: "stroke-dashoffset 0.2s linear" }}
              />
            </svg>
            <span className="font-display text-lg font-bold tabular-nums">{secondsLeft}</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Navigation className="size-4" />
              {offer.distanceKm != null ? String(offer.distanceKm) + " km away" : "Nearby"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Clock className="size-4" /> {when} · {offer.slot}
            </span>
          </div>

          <div className="rounded-2xl border border-line bg-surface-muted/40 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Car className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display font-semibold text-ink">{offer.vehicleName}</p>
                <p className="text-sm text-muted">
                  {VEHICLE_LABEL[offer.vehicleType] ?? offer.vehicleType} · {offer.packageName}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 border-t border-line/70 pt-3 text-sm text-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="font-medium text-ink">{offer.addressLabel}</span> — {offer.addressLine}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <Sparkles className="size-4" /> Your payout
            </span>
            <span className="font-display text-2xl font-bold text-emerald-700">{formatMoney(offer.payout)}</span>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={decline} disabled={accepting}>
              <X className="size-4" /> Decline
            </Button>
            <Button
              className="flex-[1.6] bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              onClick={accept}
              disabled={accepting || expired}
            >
              <Check className="size-4" /> {expired ? "Expired" : accepting ? "Accepting…" : "Accept job"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
