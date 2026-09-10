import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, AlertTriangle, WifiOff, Radio } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { LiveTrackingMap } from "@shared/components/map/LiveTrackingMap";
import { useAgentLocation } from "../api/admin.api";

/** Above this, the fix on screen is old enough to say so rather than imply it's current. */
const FIX_STALE_SECONDS = 45;

/**
 * The admin's live view of one cleaner's position, independent of any active
 * job — unlike `TrackingModal`, which watches a booking.
 *
 * Polled REST rather than a socket subscription: a cleaner without an active
 * job never joins a booking room, so there is no live channel to listen on.
 * The position is still fresh in practice — the agent app persists a GPS fix
 * to the database on roughly the same ~5s cadence this polls at, whenever
 * they're online.
 */
export function AgentLocationModal({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useAgentLocation(agentId, true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Ticks the "Xs ago" label every second so it visibly counts up between polls.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const fix = data?.agentLocation ?? null;
  const agentPos = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const staleSeconds = fix ? Math.max(0, Math.round((now - new Date(fix.updatedAt).getTime()) / 1000)) : null;
  const stale = staleSeconds != null && staleSeconds > FIX_STALE_SECONDS;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Agent live location"
      >
        <motion.div
          className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start gap-3 border-b border-line px-5 py-4">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Radio className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold text-ink">Live location</h2>
              <p className="truncate text-sm text-muted">{agentName}</p>
            </div>
            {data && (
              <span
                className={cn(
                  "mt-1 hidden shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  data.online ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/5 text-muted",
                )}
              >
                <span className={cn("size-1.5 rounded-full", data.online ? "bg-emerald-500" : "bg-muted")} />
                {data.online ? "Online" : "Offline"}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && !data ? (
              <div className="grid h-72 place-items-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : error && !data ? (
              <div className="grid h-72 place-items-center px-6 text-center">
                <div>
                  <AlertTriangle className="mx-auto size-7 text-amber-500" />
                  <p className="mt-2 font-medium text-ink">Couldn't load this agent's location</p>
                  <p className="mt-1 text-sm text-muted">{error instanceof Error ? error.message : "Please try again."}</p>
                </div>
              </div>
            ) : (
              <>
                <LiveTrackingMap
                  destination={null}
                  agent={agentPos}
                  heading={fix?.heading ?? null}
                  showRoute={false}
                  badge={agentPos ? { title: stale ? "Last seen" : "Live", subtitle: `${staleSeconds}s ago` } : null}
                  className="h-[48dvh] min-h-[280px] w-full"
                />

                {!agentPos && (
                  <p className="flex items-center gap-2 border-t border-line bg-surface-muted px-5 py-3 text-sm text-muted">
                    <WifiOff className="size-4 shrink-0" />
                    {agentName} hasn't shared a location recently — they may be offline, their app may be closed, or
                    location permission is off.
                  </p>
                )}

                {stale && agentPos && (
                  <p className="flex items-center gap-2 border-t border-line bg-amber-50 px-5 py-3 text-sm font-medium text-amber-700">
                    <WifiOff className="size-4 shrink-0" />
                    Last fix {staleSeconds}s ago — this position may be out of date.
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
