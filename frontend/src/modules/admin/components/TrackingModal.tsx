import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Loader2,
  AlertTriangle,
  MapPin,
  Navigation2,
  Phone,
  User,
  Clock,
  WifiOff,
  Radio,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { formatDistance } from "@shared/lib/maps";
import { formatDate, formatMoney, shortId } from "@shared/lib/format";
import { LiveTrackingMap, type RouteInfo } from "@shared/components/map/LiveTrackingMap";
import { useLiveTracking, FIX_STALE_SECONDS } from "@shared/hooks/useLiveTracking";
import type { JobStatus } from "@shared/types/tracking";

const JOB_LABEL: Record<JobStatus, string> = {
  assigned: "Assigned",
  enroute: "On the way",
  arrived: "Arrived",
  in_progress: "Cleaning",
  completed: "Completed",
};

/**
 * The admin's live view of one job.
 *
 * A modal rather than its own route: dispatch is a monitoring screen that an
 * admin keeps open and scans, and navigating away from the queue to look at one
 * booking loses the sorted list and every live subscription behind it. Closing
 * the modal puts them back exactly where they were.
 */
export function TrackingModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { snapshot, fix, loading, error, connected, staleSeconds } = useLiveTracking(bookingId);
  const [route, setRoute] = useState<RouteInfo | null>(null);

  // Escape closes, and the page behind must not scroll under the overlay.
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

  const agentPos = useMemo(() => (fix ? { lat: fix.lat, lng: fix.lng } : null), [fix]);
  const travelling = snapshot?.jobStatus === "assigned" || snapshot?.jobStatus === "enroute";
  const etaMinutes = travelling ? (route?.etaMinutes ?? snapshot?.etaMinutes ?? null) : null;
  const distanceM = travelling ? (route?.distanceM ?? snapshot?.distanceM ?? null) : null;
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
        aria-label="Live job tracking"
      >
        <motion.div
          className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
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
              <h2 className="font-display text-lg font-semibold text-ink">Live tracking</h2>
              <p className="truncate text-sm text-muted" title={bookingId}>
                Booking {shortId(bookingId)}
                {snapshot ? ` · ${snapshot.packageName} · ${snapshot.vehicleName}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "mt-1 hidden shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium sm:inline-flex",
                connected ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/5 text-muted",
              )}
            >
              <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-muted")} />
              {connected ? "Connected" : "Connecting…"}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && !snapshot ? (
              <div className="grid h-64 place-items-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : error && !snapshot ? (
              <div className="grid h-64 place-items-center px-6 text-center">
                <div>
                  <AlertTriangle className="mx-auto size-7 text-amber-500" />
                  <p className="mt-2 font-medium text-ink">Couldn't load this job</p>
                  <p className="mt-1 text-sm text-muted">{error}</p>
                </div>
              </div>
            ) : snapshot ? (
              <>
                <LiveTrackingMap
                  destination={snapshot.destination}
                  agent={agentPos}
                  heading={fix?.heading ?? null}
                  showRoute={!!agentPos && travelling}
                  pulseDestination={!snapshot.agent}
                  onRoute={setRoute}
                  badge={
                    agentPos
                      ? travelling && etaMinutes != null
                        ? { title: "ETA", subtitle: `${etaMinutes} min` }
                        : { title: "Status", subtitle: JOB_LABEL[snapshot.jobStatus] }
                      : null
                  }
                  className="h-[38dvh] min-h-[220px] w-full"
                />

                {!snapshot.agent && (
                  <p className="flex items-center gap-2 border-b border-line bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700">
                    <AlertTriangle className="size-4 shrink-0" />
                    No cleaner assigned yet — nothing to track until one accepts.
                  </p>
                )}

                {snapshot.agent && !agentPos && (
                  <p className="flex items-center gap-2 border-b border-line bg-surface-muted px-5 py-2.5 text-sm text-muted">
                    <WifiOff className="size-4 shrink-0" />
                    {snapshot.agent.name} hasn't sent a location yet — their app may be closed or
                    location permission is off.
                  </p>
                )}

                {stale && agentPos && (
                  <p className="flex items-center gap-2 border-b border-line bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700">
                    <WifiOff className="size-4 shrink-0" />
                    Last fix {staleSeconds}s ago — this position may be out of date.
                  </p>
                )}

                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <Panel title="Cleaner" icon={User}>
                    {snapshot.agent ? (
                      <>
                        <p className="font-semibold text-ink" data-testid="admin-track-agent">
                          {snapshot.agent.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {snapshot.agent.jobsDone} washes · rating{" "}
                          {snapshot.agent.rating ? snapshot.agent.rating.toFixed(1) : "—"}
                        </p>
                        {snapshot.agent.phone && (
                          <a
                            href={`tel:${snapshot.agent.phone}`}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <Phone className="size-3.5" /> {snapshot.agent.phone}
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted">Unassigned</p>
                    )}
                  </Panel>

                  <Panel title="Customer" icon={User}>
                    <p className="font-semibold text-ink">{snapshot.customerName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {snapshot.addressLabel}
                      {snapshot.society ? ` · ${snapshot.society}` : ""}
                    </p>
                    {snapshot.customerPhone && (
                      <a
                        href={`tel:${snapshot.customerPhone}`}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Phone className="size-3.5" /> {snapshot.customerPhone}
                      </a>
                    )}
                  </Panel>

                  <Panel title="Progress" icon={Clock}>
                    <p className="font-semibold text-ink">{JOB_LABEL[snapshot.jobStatus]}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(snapshot.date)} · {snapshot.slot} · {formatMoney(snapshot.price)}
                    </p>
                  </Panel>

                  <Panel title="Distance to customer" icon={Navigation2}>
                    <p className="font-semibold text-ink" data-testid="admin-track-distance">
                      {travelling ? formatDistance(distanceM) : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {travelling && etaMinutes != null
                        ? `About ${etaMinutes} min away`
                        : snapshot.jobStatus === "completed"
                          ? "Job finished"
                          : "On site"}
                    </p>
                  </Panel>

                  {!snapshot.destination && (
                    <div className="sm:col-span-2 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      This booking has no saved map pin, so distance and ETA can't be computed.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-muted/50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Icon className="size-3" />
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
