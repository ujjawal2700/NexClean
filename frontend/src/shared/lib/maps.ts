/**
 * Google Maps JS access, in one place.
 *
 * The `<script>` tag lives in index.html (async), so at any given moment the
 * API may be absent, still loading, or ready. Every map surface needs the same
 * answer to "can I draw yet?", and each one polling `window.google` on its own
 * is how you end up with maps that render on a fast connection and stay blank
 * on a slow one.
 */

declare global {
  interface Window {
    google?: any;
    /** Google calls this when the API key is rejected. See below. */
    gm_authFailure?: () => void;
  }
}

export type LatLng = { lat: number; lng: number };

/** Whether a Maps key was configured at build time. */
export const MAPS_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? "";
export const MAPS_CONFIGURED = MAPS_KEY.trim().length > 0;

/** How long to wait for the async script before declaring it unavailable. */
const LOAD_TIMEOUT_MS = 12_000;
const POLL_MS = 120;

let readyPromise: Promise<boolean> | null = null;

/* --------------------------- key authentication --------------------------- */

let authFailed = false;
const authListeners = new Set<() => void>();

/**
 * A rejected key is worse than a missing one.
 *
 * When the key is absent the script never loads and every surface takes its
 * "maps unavailable" path. When the key is present but rejected — unbilled,
 * referrer-restricted, wrong project — the API loads perfectly, `google.maps.Map`
 * exists, the map object constructs, and then no tiles ever arrive: the viewer
 * gets a silent grey rectangle with a cleaner apparently sitting in a void.
 *
 * `gm_authFailure` is the one signal Google gives for this, and it fires
 * asynchronously — often after the map has already been created — so it has to
 * notify existing maps rather than only gate new ones.
 */
if (typeof window !== "undefined") {
  window.gm_authFailure = () => {
    authFailed = true;
    console.error(
      "[maps] Google rejected the Maps API key (check billing, API restrictions and the referrer allowlist). Falling back to the no-map view.",
    );
    authListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* one bad listener must not stop the rest */
      }
    });
  };
}

/** Whether Google has rejected the configured key. */
export function mapsAuthFailed(): boolean {
  return authFailed;
}

/** Subscribe to key rejection. Returns an unsubscribe function. */
export function onMapsAuthFailure(fn: () => void): () => void {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

/** True the instant the API is usable, without waiting on a promise tick. */
export function mapsReady(): boolean {
  return typeof window !== "undefined" && !authFailed && !!window.google?.maps?.Map;
}

/**
 * Resolves true once the Maps API is usable, false if it never arrives.
 *
 * Never rejects: a missing map is a degraded screen, not a crash, and every
 * caller has a no-map fallback to fall into.
 */
export function loadMaps(): Promise<boolean> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<boolean>((resolve) => {
    if (mapsReady()) return resolve(true);
    if (!MAPS_CONFIGURED) return resolve(false);

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (mapsReady()) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
        window.clearInterval(timer);
        console.warn("[maps] Google Maps JS did not load — falling back to the no-map view.");
        resolve(false);
      }
    }, POLL_MS);
  });

  return readyPromise;
}

/* ------------------------------- geometry -------------------------------- */

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. Mirrors the server's haversine exactly. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Compass bearing in degrees (0 = north) from one point to another. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Linear interpolation between two points — the basis of smooth marker motion. */
export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Same fallback ETA rule the server uses, so the two never disagree on screen.
 * Overridden by Google's real driving estimate wherever Directions succeeds.
 */
export const FALLBACK_SPEED_KMH = 20;
export const MIN_ETA_MINUTES = 2;

export function fallbackEtaMinutes(meters: number): number {
  return Math.max(MIN_ETA_MINUTES, Math.round((meters / 1000 / FALLBACK_SPEED_KMH) * 60));
}

/** "450 m" / "3.2 km" — the unit a customer actually reads at that scale. */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Deep-link into whichever navigation app the device prefers. */
export function navigationUrl(destination: LatLng, origin?: LatLng | null): string {
  const dest = `${destination.lat},${destination.lng}`;
  const from = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${from}&travelmode=driving`;
}

/* ----------------------------- map appearance ----------------------------- */

/**
 * A muted basemap so the route line and the two markers are the only things
 * with any colour. Google's default styling competes with them for attention,
 * which is the opposite of what a tracking screen needs.
 */
export const TRACKING_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f7f9fc" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#70798b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e4f2e4" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9aa3b5" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f0f3fa" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d7e3fb" }] },
];

export const MAP_OPTIONS_BASE = {
  disableDefaultUI: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  styles: TRACKING_MAP_STYLE,
};
