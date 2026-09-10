import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, LifeBuoy, Loader2, AlertTriangle, CheckCircle2, CalendarClock, Ban, Camera } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { formatMoney, formatDate, shortId } from "@shared/lib/format";
import { ApiError } from "@shared/lib/api";
import { LiveTrackingMap, type RouteInfo } from "@shared/components/map/LiveTrackingMap";
import { useLiveTracking, FIX_STALE_SECONDS } from "@shared/hooks/useLiveTracking";
import { useCancelBooking } from "../../api/mutations";
import { SearchingPanel } from "./SearchingPanel";
import { AgentPanel } from "./AgentPanel";
import { ServicePhotosModal } from "../../components/ServicePhotosModal";

/**
 * The customer's live tracking screen.
 *
 * One route covers the whole life of a booking — searching, assigned, in
 * progress, finished — because they are the same journey and bouncing the
 * customer between URLs as the state changes loses the map, the scroll
 * position and any sense of continuity. What changes is the panel under the
 * map, not the page.
 */
export function TrackBooking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { snapshot, fix, loading, error, staleSeconds, refresh } = useLiveTracking(id);
  const cancelBooking = useCancelBooking();

  // Google's live driving estimate, when Directions can supply one. It beats
  // the server's straight-line guess, so it wins wherever it exists.
  const [route, setRoute] = useState<RouteInfo | null>(null);
  useEffect(() => setRoute(null), [id]);

  const [cancelError, setCancelError] = useState("");
  const [showPhotos, setShowPhotos] = useState(false);

  const agentPos = useMemo(() => (fix ? { lat: fix.lat, lng: fix.lng } : null), [fix]);

  const travelling = snapshot?.jobStatus === "assigned" || snapshot?.jobStatus === "enroute";
  const etaMinutes = travelling ? (route?.etaMinutes ?? snapshot?.etaMinutes ?? null) : null;
  const distanceM = travelling ? (route?.distanceM ?? snapshot?.distanceM ?? null) : null;
  const stale = staleSeconds != null && staleSeconds > FIX_STALE_SECONDS;

  const cancel = async () => {
    if (!id) return;
    setCancelError("");
    try {
      await cancelBooking.mutateAsync(id);
      navigate("/app/bookings");
    } catch (e) {
      // A cancel can be legitimately refused — a subscription wash inside its
      // 12-hour window, for instance. Saying so is the whole point: the button
      // used to fail silently, leaving the customer tapping it with no idea
      // why nothing happened.
      setCancelError(
        e instanceof ApiError ? e.message : "Couldn't cancel just now — please try again.",
      );
      refresh();
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto size-8 text-amber-500" />
          <h1 className="mt-3 font-display text-xl font-semibold text-ink">Can't track this booking</h1>
          <p className="mt-1.5 text-sm text-muted">{error}</p>
          <Button className="mt-5" onClick={() => navigate("/app/bookings")}>
            Back to bookings
          </Button>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const searching =
    snapshot.status === "upcoming" &&
    !snapshot.agent &&
    ["searching", "offered", "pending_admin", "scheduled"].includes(snapshot.dispatchStatus);

  const finished = snapshot.status === "completed" || snapshot.jobStatus === "completed";
  const cancelled = snapshot.status === "cancelled";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Header — mirrors the order header of a delivery app: identity, the
          essentials, and a way out. */}
      <header className="z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/app/bookings")}
            aria-label="Close tracking"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p
              className="truncate font-display text-[0.95rem] font-semibold uppercase tracking-wide text-ink"
              title={snapshot.bookingId}
            >
              Booking {shortId(snapshot.bookingId)}
            </p>
            <p className="truncate text-xs text-muted">
              {formatDate(snapshot.date)} · {snapshot.slot} · {formatMoney(snapshot.price)}
            </p>
          </div>

          <Link
            to="/app/help"
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/8"
          >
            <span className="flex items-center gap-1">
              <LifeBuoy className="size-3.5" />
              Help
            </span>
          </Link>
        </div>
      </header>

      {/* The map. Fixed proportion of the viewport so the panel below always
          has room — a map that grows to fill pushes the status off-screen on
          small phones, which is the one thing that must stay visible. */}
      <div className="relative">
        <LiveTrackingMap
          destination={snapshot.destination}
          agent={agentPos}
          heading={fix?.heading ?? null}
          showRoute={!!agentPos && travelling}
          pulseDestination={searching}
          onRoute={setRoute}
          badge={
            travelling && etaMinutes != null
              ? { title: "ETA", subtitle: `${etaMinutes} min` }
              : snapshot.jobStatus === "arrived"
                ? { title: "Status", subtitle: "Arrived" }
                : snapshot.jobStatus === "in_progress"
                  ? { title: "Status", subtitle: "Cleaning" }
                  : null
          }
          className="h-[42dvh] min-h-[240px] w-full sm:h-[46dvh]"
        />

        {!snapshot.destination && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-50/95 px-4 py-2 text-center text-xs font-medium text-amber-700">
            No map pin was saved for this booking — your cleaner will use the address.
          </div>
        )}
      </div>

      {/* The panel. Lifted over the map's bottom edge so the two read as one
          surface, the way a sheet sits over a map rather than beside it. */}
      <div className="relative z-10 -mt-5 flex-1 rounded-t-3xl border-t border-line bg-surface shadow-lift">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />

          <AnimatePresence mode="wait">
            {cancelled ? (
              <TerminalPanel
                key="cancelled"
                icon={<Ban className="size-6 text-muted" />}
                title="This booking was cancelled"
                body="Nothing more is happening here. Book again whenever you're ready."
                action={{ label: "Book a wash", to: "/app/book" }}
              />
            ) : finished ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 pb-8 pt-6 text-center"
              >
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </div>
                <h2 className="mt-3 font-display text-xl font-semibold text-ink">Service complete</h2>
                <p className="mx-auto mt-1.5 max-w-[36ch] text-sm text-muted">
                  {snapshot.agent?.name ?? "Your cleaner"} finished your {snapshot.packageName}.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setShowPhotos(true)} data-testid="tracking-view-photos">
                    <Camera className="size-4" /> View Service Photos
                  </Button>
                  <Button asChild>
                    <Link to="/app/bookings">View all bookings</Link>
                  </Button>
                </div>
              </motion.div>
            ) : searching ? (
              <motion.div
                key="searching"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <SearchingPanel
                  snapshot={snapshot}
                  onCancel={cancel}
                  cancelling={cancelBooking.isPending}
                  cancelError={cancelError}
                />
              </motion.div>
            ) : snapshot.agent ? (
              <motion.div
                key="assigned"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AgentPanel
                  snapshot={snapshot}
                  etaMinutes={etaMinutes}
                  distanceM={distanceM}
                  stale={stale}
                />
              </motion.div>
            ) : (
              <TerminalPanel
                key="scheduled"
                icon={<CalendarClock className="size-6 text-violet-500" />}
                title="Scheduled"
                body="A cleaner will be assigned automatically before your slot. You'll be able to track them live from here."
                action={{ label: "Back to bookings", to: "/app/bookings" }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {showPhotos && (
        <ServicePhotosModal booking={snapshot} onClose={() => setShowPhotos(false)} />
      )}
    </div>
  );
}

function TerminalPanel({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { label: string; to: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("px-5 pb-8 pt-6 text-center")}
    >
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-muted">{icon}</div>
      <h2 className="mt-3 font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-sm text-muted">{body}</p>
      <Button asChild className="mt-5">
        <Link to={action.to}>{action.label}</Link>
      </Button>
    </motion.div>
  );
}
