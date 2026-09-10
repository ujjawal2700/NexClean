import { useEffect, useRef, useState } from "react";
import { MapPinned, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import {
  MAP_OPTIONS_BASE,
  bearingDegrees,
  distanceMeters,
  fallbackEtaMinutes,
  lerpLatLng,
  type LatLng,
} from "@shared/lib/maps";
import { useGoogleMaps } from "@shared/hooks/useGoogleMaps";
import { agentIconUri, destinationIconUri } from "./mapGraphics";
import { createEtaBadge } from "./useEtaBadge";

export type RouteInfo = { etaMinutes: number; distanceM: number; source: "google" | "estimate" };

type Props = {
  /** Where the cleaner is heading — the pin the customer dropped. */
  destination: LatLng | null;
  /** Latest known position of the cleaner, or null when there isn't one yet. */
  agent: LatLng | null;
  /** Compass degrees for the agent marker; derived from movement when absent. */
  heading?: number | null;
  /** Text above the marker. Pass null to hide the pill entirely. */
  badge?: { title: string; subtitle: string } | null;
  /** Draw the real driving route rather than just the two pins. */
  showRoute?: boolean;
  /** Fires whenever a fresher route estimate is available. */
  onRoute?: (info: RouteInfo | null) => void;
  /** Concentric pulses on the destination, for the "finding a cleaner" state. */
  pulseDestination?: boolean;
  className?: string;
};

/** Re-ask Directions only after the agent has genuinely moved this far. */
const ROUTE_REFRESH_METERS = 120;
/** …or after this long, so traffic changes still land on a slow-moving job. */
const ROUTE_REFRESH_MS = 30_000;
/** Duration of the glide between two GPS fixes. */
const MARKER_EASE_MS = 900;

/**
 * The shared live map: a destination pin, a cleaner that glides between GPS
 * fixes, and the driving route between them.
 *
 * All three role apps render this same component, so the customer, the cleaner
 * and the admin are always looking at the identical geometry — only the framing
 * around it differs.
 */
export function LiveTrackingMap({
  destination,
  agent,
  heading,
  badge,
  showRoute = true,
  onRoute,
  pulseDestination = false,
  className,
}: Props) {
  const ready = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const agentMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const straightLineRef = useRef<any>(null);
  const pulseRefs = useRef<any[]>([]);
  const badgeRef = useRef<ReturnType<typeof createEtaBadge> | null>(null);
  const directionsRef = useRef<any>(null);

  // Animation state for the agent marker, kept in refs so the rAF loop never
  // restarts on render.
  const renderedPosRef = useRef<LatLng | null>(null);
  const animationRef = useRef<number | null>(null);
  const headingRef = useRef<number | null>(null);
  const iconHeadingRef = useRef<number | null>(null);

  // Route bookkeeping — what the last Directions call was made for.
  const lastRouteOriginRef = useRef<LatLng | null>(null);
  const lastRouteAtRef = useRef(0);
  const routeFailedRef = useRef(false);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  // Once the viewer pans or zooms, stop stealing the camera back from them.
  const userMovedRef = useRef(false);
  const fittedRef = useRef(false);

  const [failed, setFailed] = useState(false);

  /* ------------------------------ map setup ------------------------------ */
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const google = window.google;
    try {
      const center = destination ?? agent ?? { lat: 28.4595, lng: 77.0266 };
      const map = new google.maps.Map(containerRef.current, {
        ...MAP_OPTIONS_BASE,
        center,
        zoom: 14,
      });
      mapRef.current = map;

      // `dragstart`/`zoom_changed` fire for programmatic camera moves too, so
      // the flag is only set from gestures the viewer actually made.
      map.addListener("dragstart", () => {
        userMovedRef.current = true;
      });
      map.addListener("click", () => {
        userMovedRef.current = true;
      });

      badgeRef.current = createEtaBadge(map, google);
      directionsRef.current = new google.maps.DirectionsService();
    } catch (err) {
      console.error("[map] init failed:", err);
      setFailed(true);
    }

    /**
     * Tear down to the same state a first mount starts from.
     *
     * Every overlay below belongs to the map being destroyed, so a ref left
     * pointing at one survives into the next mount and makes the guards that
     * read it ("do I already have a marker?") answer yes about an object
     * attached to a map that no longer exists — the new map then renders with
     * no markers and no route on it at all. React's StrictMode double-invokes
     * this in development, so that second mount is not a rare path: it is every
     * page load.
     */
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;

      badgeRef.current?.destroy();
      badgeRef.current = null;
      destMarkerRef.current?.setMap(null);
      destMarkerRef.current = null;
      agentMarkerRef.current?.setMap(null);
      agentMarkerRef.current = null;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      straightLineRef.current?.setMap(null);
      straightLineRef.current = null;
      pulseRefs.current.forEach((c) => c.setMap(null));
      pulseRefs.current = [];
      directionsRef.current = null;

      // Marker animation and camera state describe the old map's viewport.
      renderedPosRef.current = null;
      headingRef.current = null;
      iconHeadingRef.current = null;
      fittedRef.current = false;
      userMovedRef.current = false;

      // Clearing the route bookkeeping is what lets the new map draw a line at
      // all: the throttle would otherwise see a recent request for this same
      // origin and skip straight past drawing one.
      lastRouteOriginRef.current = null;
      lastRouteAtRef.current = 0;
      routeFailedRef.current = false;

      mapRef.current = null;
    };
    // Centre/zoom are seeded once; everything after is driven by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* --------------------------- destination pin --------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const google = window.google;

    if (!destination) {
      destMarkerRef.current?.setMap(null);
      destMarkerRef.current = null;
      return;
    }

    if (!destMarkerRef.current) {
      destMarkerRef.current = new google.maps.Marker({
        map,
        icon: {
          url: destinationIconUri(),
          scaledSize: new google.maps.Size(44, 54),
          anchor: new google.maps.Point(22, 54),
        },
        zIndex: 3,
        title: "Service location",
      });
    }
    destMarkerRef.current.setPosition(destination);
  }, [destination, ready]);

  /* ------------------------- searching pulse rings ----------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const google = window.google;

    pulseRefs.current.forEach((c) => c.setMap(null));
    pulseRefs.current = [];
    if (!pulseDestination || !destination) return;

    // Three rings on staggered phases read as one expanding wave. Radius is in
    // metres so the pulse stays geographically honest as the viewer zooms —
    // it is showing a search area, not decoration.
    const rings = [0, 1, 2].map(() =>
      new google.maps.Circle({
        map,
        center: destination,
        radius: 300,
        strokeColor: "#4f7cff",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        fillColor: "#4f7cff",
        fillOpacity: 0.07,
        clickable: false,
        zIndex: 1,
      }),
    );
    pulseRefs.current = rings;

    const PERIOD_MS = 2800;
    const MAX_RADIUS_M = 1500;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      rings.forEach((ring, i) => {
        const t = ((elapsed / PERIOD_MS + i / 3) % 1);
        ring.setRadius(120 + t * MAX_RADIUS_M);
        ring.setOptions({ strokeOpacity: 0.55 * (1 - t), fillOpacity: 0.09 * (1 - t) });
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      rings.forEach((r) => r.setMap(null));
      pulseRefs.current = [];
    };
  }, [pulseDestination, destination, ready]);

  /* ------------------- agent marker: glide between fixes ------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const google = window.google;

    if (!agent) {
      agentMarkerRef.current?.setMap(null);
      agentMarkerRef.current = null;
      badgeRef.current?.setPosition(null);
      renderedPosRef.current = null;
      return;
    }

    if (!agentMarkerRef.current) {
      agentMarkerRef.current = new google.maps.Marker({
        map,
        position: agent,
        icon: {
          url: agentIconUri(heading ?? null),
          scaledSize: new google.maps.Size(46, 46),
          anchor: new google.maps.Point(23, 23),
        },
        zIndex: 4,
        title: "Your cleaner",
      });
      renderedPosRef.current = agent;
      iconHeadingRef.current = heading ?? null;
      badgeRef.current?.setPosition(agent);
      return;
    }

    const from = renderedPosRef.current ?? agent;
    const to = agent;

    // A device that reports no heading still tells us where it is going, as
    // long as it moved far enough for the bearing to mean anything.
    const derived =
      heading == null && distanceMeters(from, to) > 8 ? bearingDegrees(from, to) : heading ?? null;
    if (derived != null) headingRef.current = derived;

    // Repainting the SVG on every one-degree wobble thrashes the icon cache for
    // no visible gain, so the artwork only changes on a real turn.
    const nextHeading = headingRef.current;
    if (
      nextHeading != null &&
      (iconHeadingRef.current == null || Math.abs(nextHeading - iconHeadingRef.current) > 8)
    ) {
      iconHeadingRef.current = nextHeading;
      agentMarkerRef.current.setIcon({
        url: agentIconUri(nextHeading),
        scaledSize: new google.maps.Size(46, 46),
        anchor: new google.maps.Point(23, 23),
      });
    }

    // A fix arrives every second or so; snapping the marker to each one looks
    // like teleporting. Easing across the gap is what makes it read as driving.
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const startedAt = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / MARKER_EASE_MS);
      // easeOutCubic: quick off the mark, settles gently on the new fix.
      const eased = 1 - Math.pow(1 - t, 3);
      const pos = lerpLatLng(from, to, eased);
      renderedPosRef.current = pos;
      agentMarkerRef.current?.setPosition(pos);
      badgeRef.current?.setPosition(pos);
      if (t < 1) animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  }, [agent, heading, ready]);

  /* ------------------------------ the badge ------------------------------ */
  useEffect(() => {
    if (!badgeRef.current) return;
    if (!badge || !agent) {
      badgeRef.current.setPosition(null);
      return;
    }
    badgeRef.current.setText(badge.title, badge.subtitle);
    badgeRef.current.setPosition(renderedPosRef.current ?? agent);
  }, [badge, agent]);

  /* ------------------------------- the route ----------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !showRoute || !destination || !agent) {
      routeLineRef.current?.setMap(null);
      straightLineRef.current?.setMap(null);
      return;
    }
    const google = window.google;

    const drawStraightLine = () => {
      // The honest fallback when Directions is unavailable: say "roughly this
      // way" with a dashed line rather than draw a road route we don't have.
      if (!straightLineRef.current) {
        straightLineRef.current = new google.maps.Polyline({
          map,
          strokeOpacity: 0,
          zIndex: 2,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#4f7cff",
                fillOpacity: 0.9,
                scale: 2.6,
                strokeOpacity: 0,
              },
              offset: "0",
              repeat: "12px",
            },
          ],
        });
      }
      straightLineRef.current.setPath([agent, destination]);
      straightLineRef.current.setMap(map);
      routeLineRef.current?.setMap(null);

      const meters = distanceMeters(agent, destination);
      onRouteRef.current?.({
        etaMinutes: fallbackEtaMinutes(meters),
        distanceM: Math.round(meters),
        source: "estimate",
      });
    };

    if (routeFailedRef.current) {
      drawStraightLine();
      return;
    }

    // Directions is billed per call, and the agent's marker moves every second.
    // Re-route on real displacement or on a timer, never on every fix.
    const movedFar =
      !lastRouteOriginRef.current ||
      distanceMeters(lastRouteOriginRef.current, agent) > ROUTE_REFRESH_METERS;
    const stale = Date.now() - lastRouteAtRef.current > ROUTE_REFRESH_MS;
    if (!movedFar && !stale) return;

    lastRouteOriginRef.current = agent;
    lastRouteAtRef.current = Date.now();

    directionsRef.current?.route(
      {
        origin: agent,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status !== "OK" || !result?.routes?.[0]) {
          // Only give up permanently on answers that will not change.
          // REQUEST_DENIED / API-not-activated means Directions is simply not
          // available for this key, and retrying just bills failures. But
          // ZERO_RESULTS is a fact about this pair of points, and
          // OVER_QUERY_LIMIT / UNKNOWN_ERROR are transient — latching on those
          // used to strand the route on a dashed line for the rest of the page
          // view because of one rate-limited call.
          const permanent = status === "REQUEST_DENIED" || status === "INVALID_REQUEST";
          if (permanent) {
            routeFailedRef.current = true;
            console.warn(`[map] Directions unavailable (${status}) — falling back to a direct line.`);
          } else {
            // Let the next fix try again rather than waiting out the timer.
            lastRouteOriginRef.current = null;
          }
          drawStraightLine();
          return;
        }

        const route = result.routes[0];
        straightLineRef.current?.setMap(null);

        if (!routeLineRef.current) {
          routeLineRef.current = new google.maps.Polyline({
            map,
            strokeColor: "#4f7cff",
            strokeOpacity: 0.95,
            strokeWeight: 5,
            zIndex: 2,
          });
        }
        routeLineRef.current.setPath(route.overview_path);
        routeLineRef.current.setMap(map);

        const leg = route.legs?.[0];
        if (leg?.duration && leg?.distance) {
          onRouteRef.current?.({
            etaMinutes: Math.max(1, Math.round(leg.duration.value / 60)),
            distanceM: leg.distance.value,
            source: "google",
          });
        }
      },
    );
  }, [agent, destination, showRoute, ready]);

  /* ------------------------------ the camera ----------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const google = window.google;
    const points = [destination, agent].filter(Boolean) as LatLng[];
    if (points.length === 0) return;

    // Frame both pins once, then leave the camera alone unless it is following
    // a marker that would otherwise walk off screen.
    if (!fittedRef.current) {
      fittedRef.current = true;
      if (points.length === 1) {
        map.setCenter(points[0]);
        map.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { top: 90, right: 60, bottom: 140, left: 60 });
      }
      return;
    }

    if (userMovedRef.current) return;
    const visible = map.getBounds();
    if (visible && points.every((p) => visible.contains(new google.maps.LatLng(p.lat, p.lng)))) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 90, right: 60, bottom: 140, left: 60 });
  }, [destination, agent, ready]);

  /* ------------------------------ rendering ------------------------------ */

  if (ready === false || failed) {
    return <MapFallback className={className} destination={destination} agent={agent} />;
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-muted", className)}>
      <div ref={containerRef} className="absolute inset-0" data-testid="live-map-canvas" />
      {ready === undefined && (
        <div className="absolute inset-0 grid place-items-center bg-surface-muted">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

/**
 * What the screen shows when Maps is unavailable (no key, blocked script,
 * offline). The tracking flow still works — the positions are real and the
 * distance is real — so the fallback shows that geometry schematically instead
 * of collapsing to an error.
 */
function MapFallback({
  className,
  destination,
  agent,
}: {
  className?: string;
  destination: LatLng | null;
  agent: LatLng | null;
}) {
  const meters = destination && agent ? distanceMeters(agent, destination) : null;

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-surface-muted",
        className,
      )}
      data-testid="live-map-fallback"
    >
      <svg
        viewBox="0 0 320 200"
        className="absolute inset-0 size-full opacity-[0.35]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="tracking-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0v32" fill="none" stroke="#c9d5ec" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="320" height="200" fill="url(#tracking-grid)" />
        {agent && destination && (
          <path
            d="M60 150 C 120 150, 140 70, 250 60"
            fill="none"
            stroke="#4f7cff"
            strokeWidth="3"
            strokeDasharray="7 8"
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
        <MapPinned className="size-7 text-primary" />
        <p className="text-sm font-semibold text-ink">
          {agent ? "Your cleaner is on the way" : "Live map unavailable"}
        </p>
        <p className="max-w-[26ch] text-xs text-muted">
          {meters != null
            ? `About ${(meters / 1000).toFixed(1)} km away — the map needs a Google Maps key to draw the route.`
            : "Tracking still works; the map view needs a Google Maps key."}
        </p>
      </div>
    </div>
  );
}
