import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { MAP_OPTIONS_BASE, type LatLng } from "@shared/lib/maps";
import { useGoogleMaps } from "@shared/hooks/useGoogleMaps";

type Props = {
  /** Current pin, or null to start from `fallbackCenter`. */
  value: LatLng | null;
  onChange: (coords: LatLng, formattedAddress?: string) => void;
  /** Where to open when there is no pin yet — usually the geocoded address. */
  fallbackCenter?: LatLng | null;
  className?: string;
};

/** Gurugram, the launch city — only ever used when nothing better is known. */
const DEFAULT_CENTER: LatLng = { lat: 28.4595, lng: 77.0266 };

/**
 * Drop the exact service pin.
 *
 * The pin is pinned to the centre of the viewport and the map moves underneath
 * it, rather than being a marker you drag. On a phone that difference is the
 * whole usability of the control: dragging a marker means hitting a 40px target
 * with the thumb that is also covering it, while panning the map works
 * anywhere on the canvas.
 *
 * What this captures matters downstream — the saved address gets a cleaner
 * within a few streets, but the pin is what the cleaner actually navigates to
 * and what the customer watches them approach.
 */
export function ServicePinPicker({ value, onChange, fallbackCenter, className }: Props) {
  const ready = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [dragging, setDragging] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  /** Reverse-geocode so the customer can read back the spot they picked. */
  const describe = useCallback((coords: LatLng) => {
    const geocoder = geocoderRef.current;
    if (!geocoder) {
      onChangeRef.current(coords);
      return;
    }
    setResolving(true);
    geocoder.geocode({ location: coords }, (results: any, status: string) => {
      setResolving(false);
      const formatted = status === "OK" ? results?.[0]?.formatted_address : undefined;
      if (formatted) setAddress(formatted);
      onChangeRef.current(coords, formatted);
    });
  }, []);

  const lastReportedCenterRef = useRef<LatLng | null>(value ?? fallbackCenter ?? null);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const google = window.google;
    const center = value ?? fallbackCenter ?? DEFAULT_CENTER;

    const map = new google.maps.Map(containerRef.current, {
      ...MAP_OPTIONS_BASE,
      center,
      zoom: value || fallbackCenter ? 17 : 13,
      gestureHandling: "cooperative",
    });
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    map.addListener("dragstart", () => setDragging(true));
    map.addListener("dragend", () => setDragging(false));
    map.addListener("click", (e: any) => {
      if (e?.latLng) {
        map.panTo(e.latLng);
      }
    });

    map.addListener("idle", () => {
      setDragging(false);
      const c = map.getCenter();
      if (!c) return;
      const coords = { lat: c.lat(), lng: c.lng() };
      lastReportedCenterRef.current = coords;
      describe(coords);
    });

    return () => {
      mapRef.current = null;
    };
  }, [ready, describe]);

  // Re-centre whenever value or fallbackCenter changes from outside (e.g. search autocomplete or GPS)
  useEffect(() => {
    const map = mapRef.current;
    const target = value ?? fallbackCenter;
    if (!map || !target) return;

    const currentCenter = map.getCenter();
    const isDifferent =
      !currentCenter ||
      Math.abs(currentCenter.lat() - target.lat) > 0.0001 ||
      Math.abs(currentCenter.lng() - target.lng) > 0.0001;

    if (isDifferent) {
      lastReportedCenterRef.current = target;
      map.panTo(target);
      if (map.getZoom() < 16) {
        map.setZoom(17);
      }
    }
  }, [value, fallbackCenter]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("This browser can't share your location.");
      return;
    }
    setGeoError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapRef.current) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(18);
        } else {
          // No map to pan — the fix is still the best pin we can offer.
          describe(coords);
        }
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is off — allow it, or drag the pin instead."
            : "Couldn't get your location. Drag the pin to your spot.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  if (ready === false) {
    return (
      <div className={cn("rounded-2xl border border-line bg-surface-muted p-4", className)}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-ink">Map picker unavailable</p>
            <p className="mt-0.5 text-xs text-muted">
              Your booking will use the address above. You can still share your exact spot.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:text-primary disabled:opacity-60"
        >
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
          Use my current location
        </button>
        {geoError && <p className="mt-2 text-xs text-amber-600">{geoError}</p>}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line", className)}>
      <div className="relative h-56 bg-surface-muted sm:h-64">
        <div ref={containerRef} className="absolute inset-0" data-testid="pin-picker-canvas" />

        {ready === undefined && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {/* The pin itself: fixed to the centre, lifting slightly while the map
            moves so it reads as hovering over the ground rather than glued. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className={cn(
              "flex flex-col items-center transition-transform duration-200 ease-out",
              dragging ? "-translate-y-2" : "translate-y-0",
            )}
            style={{ transform: `translateY(${dragging ? "-0.5rem" : "0"}) translateY(-14px)` }}
          >
            <div className="grid size-9 place-items-center rounded-full bg-ink shadow-lift">
              <MapPin className="size-5 text-white" />
            </div>
            <div
              className={cn(
                "mt-0.5 h-2 w-2 rounded-full bg-ink/30 transition-all",
                dragging ? "scale-150 opacity-40" : "scale-100 opacity-70",
              )}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          aria-label="Use my current location"
          className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-soft shadow-soft transition-colors hover:text-primary disabled:opacity-60"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
        </button>
      </div>

      <div className="flex items-start gap-2 border-t border-line bg-surface px-3 py-2.5">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Cleaner will come here
          </p>
          <p className="truncate text-sm font-medium text-ink" data-testid="pin-address">
            {resolving ? "Locating…" : address || "Move the map to place your pin"}
          </p>
        </div>
      </div>

      {geoError && (
        <p className="border-t border-line bg-amber-50 px-3 py-2 text-xs text-amber-700">{geoError}</p>
      )}
    </div>
  );
}
