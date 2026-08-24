import { useMemo, useState } from "react";
import { Navigation, Crosshair, AlertTriangle, Loader2, MapPin, Phone } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { GlassCard } from "@shared/ui/GlassCard";
import { LiveTrackingMap, type RouteInfo } from "@shared/components/map/LiveTrackingMap";
import { useLiveTracking } from "@shared/hooks/useLiveTracking";
import { formatDistance, navigationUrl, type LatLng } from "@shared/lib/maps";
import type { JobStatus } from "../types";
import { useDeviceLocation } from "../hooks/useDeviceLocation";

/** How the map frames itself for each phase of the job. */
const PHASE_COPY: Record<JobStatus, { title: string; blurb: string }> = {
  assigned: { title: "Head to the customer", blurb: "Tap Navigate for turn-by-turn directions." },
  enroute: { title: "On the way", blurb: "The customer can see you moving on their map." },
  arrived: { title: "You've arrived", blurb: "Find the vehicle and start the wash." },
  in_progress: { title: "Cleaning in progress", blurb: "Take your before & after photos below." },
  completed: { title: "Job complete", blurb: "Nice work." },
};

/**
 * The cleaner's own live map: their position, the customer's exact pin, and
 * the road between them.
 *
 * Their position comes from this device's GPS rather than the relayed stream.
 * The relay makes a round trip through the server and is throttled for
 * everyone else's benefit; the phone already knows where it is, and the person
 * driving is the one who least deserves a second of lag on their own dot.
 */
export function JobNavigationCard({
  jobId,
  status,
  fallbackAddress,
  initialDestination,
}: {
  jobId: string;
  status: JobStatus;
  fallbackAddress: string;
  initialDestination?: LatLng | null;
}) {
  const { snapshot, loading } = useLiveTracking(jobId);
  const [route, setRoute] = useState<RouteInfo | null>(null);

  // The same fix the dispatch hook is streaming to the server, so the cleaner's
  // dot here and the one the customer is watching can never disagree.
  const { fix: deviceFix, error: geoError } = useDeviceLocation();
  const self: LatLng | null = useMemo(
    () => (deviceFix ? { lat: deviceFix.lat, lng: deviceFix.lng } : null),
    [deviceFix],
  );
  const heading = deviceFix?.heading ?? null;

  const destination = useMemo(
    () => snapshot?.destination ?? initialDestination ?? null,
    [snapshot?.destination, initialDestination],
  );
  const travelling = status === "assigned" || status === "enroute";
  const etaMinutes = travelling ? (route?.etaMinutes ?? snapshot?.etaMinutes ?? null) : null;
  const distanceM = travelling ? (route?.distanceM ?? null) : null;
  const phase = PHASE_COPY[status];

  return (
    <GlassCard className="overflow-hidden !p-0">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-ink" data-testid="nav-phase-title">
            {phase.title}
          </p>
          <p className="mt-0.5 text-sm text-muted">{phase.blurb}</p>
        </div>
        {travelling && etaMinutes != null && (
          <div className="shrink-0 rounded-xl bg-ink px-3 py-1.5 text-center text-white">
            <p className="font-display text-lg font-semibold leading-none tabular-nums">{etaMinutes}</p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider opacity-70">min</p>
          </div>
        )}
      </div>

      <LiveTrackingMap
        destination={destination}
        agent={self}
        heading={heading}
        showRoute={travelling && !!self && !!destination}
        onRoute={setRoute}
        badge={self && travelling ? { title: "You", subtitle: "are here" } : null}
        className="h-56 w-full sm:h-72"
      />

      {loading && !snapshot && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs text-muted sm:px-5">
          <Loader2 className="size-3.5 animate-spin" /> Loading job location…
        </div>
      )}

      {geoError && (
        <p className="flex items-start gap-2 border-t border-line bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 sm:px-5">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {geoError}
        </p>
      )}

      {!destination && !loading && (
        <p className="flex items-start gap-2 border-t border-line bg-surface-muted/60 px-4 py-2.5 text-xs text-muted sm:px-5">
          <MapPin className="mt-px size-3.5 shrink-0" />
          This booking has no map pin — navigate to the written address instead.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        <Button asChild size="sm" className="flex-1 sm:flex-none">
          <a
            href={
              destination
                ? navigationUrl(destination, self)
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress)}`
            }
            target="_blank"
            rel="noreferrer"
            data-testid="job-navigate"
          >
            <Navigation className="size-4" /> Navigate
          </a>
        </Button>

        {snapshot?.customerPhone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${snapshot.customerPhone}`}>
              <Phone className="size-4" /> Call customer
            </a>
          </Button>
        )}

        <span
          className={cn(
            "ml-auto flex items-center gap-1.5 text-xs font-medium",
            self ? "text-emerald-600" : "text-muted",
          )}
        >
          <Crosshair className={cn("size-3.5", self && "animate-pulse")} />
          {self
            ? distanceM != null
              ? `${formatDistance(distanceM)} to go`
              : "Live"
            : "Waiting for GPS…"}
        </span>
      </div>
    </GlassCard>
  );
}
