import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  MapPin,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Layers,
  Search,
  RotateCcw,
  CheckCircle,
  RefreshCw,
  X,
  Save,
  Users,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  GoogleMap,
  useJsApiLoader,
  Polygon,
  Polyline,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import {
  useCities,
  useZones,
  useCreateCity,
  useUpdateCity,
  useDeleteCity,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
  useZoneAgents,
} from "../api/admin.api";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@shared/lib/googleMaps";
import type { ServiceZone } from "../types";

const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru default
const mapContainerStyle = { width: "100%", height: "100%" };

// How close (in screen pixels) a click needs to land to the start vertex,
// once there are enough points, to close the loop instead of adding a new
// point. Generous relative to the 22px start-marker icon so it's an easy
// target, not a precision test.
const CLOSE_LOOP_HIT_RADIUS_PX = 16;

const ZONE_COLORS = [
  "#4F7CFF", // NexClean Indigo
  "#00C2FF", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Teal
  "#6366F1", // Violet
];

// Helper: extract coordinates array from zone
const getCoords = (zone?: Partial<ServiceZone> | null): [number, number][] => {
  if (zone?.coordinates && zone.coordinates.length > 0) {
    return zone.coordinates;
  }
  if (
    zone?.boundary?.coordinates?.[0] &&
    zone.boundary.coordinates[0].length > 0
  ) {
    return zone.boundary.coordinates[0] as [number, number][];
  }
  return [];
};

// Helper: convert [lng, lat] GeoJSON to Google LatLng literals (stripping duplicate closing vertex)
const toGooglePaths = (coords: [number, number][]) => {
  if (!coords || coords.length === 0) return [];
  let pts = coords;
  if (
    pts.length > 3 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1]
  ) {
    pts = pts.slice(0, -1);
  }
  return pts.map((c) => ({ lat: c[1], lng: c[0] }));
};

const computeCenter = (coords: [number, number][]) => {
  if (!coords || coords.length === 0) return defaultCenter;
  const lats = coords.map((c) => c[1]);
  const lngs = coords.map((c) => c[0]);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
};

/* ------------------------- self-intersection check ------------------------ */
// Mirrors backend/src/shared/geo.ts's segmentsIntersect/wouldSelfIntersect
// exactly, so a bowtie shape is rejected the instant it's clicked here rather
// than only discovered when the server rejects the save. [lng, lat] pairs to
// match GeoJSON, same as the rest of this file's coordinate handling.
type LngLat = [number, number];

function orientation(p: LngLat, q: LngLat, r: LngLat): 0 | 1 | 2 {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p: LngLat, q: LngLat, r: LngLat): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
}

function segmentsIntersect(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

/** Would the edge from the last placed point to `candidate` cross any edge already drawn? */
function wouldSelfIntersect(openPoints: LngLat[], candidate: LngLat): boolean {
  if (openPoints.length < 2) return false;
  const newEdgeStart = openPoints[openPoints.length - 1];
  for (let i = 0; i < openPoints.length - 2; i++) {
    if (segmentsIntersect(newEdgeStart, candidate, openPoints[i], openPoints[i + 1])) return true;
  }
  return false;
}

/** Is the fully-closed ring (first point repeated as the last) free of self-crossings? */
function isSimplePolygon(ring: LngLat[]): boolean {
  const n = ring.length - 1;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return false;
    }
  }
  return true;
}

/**
 * Small filled-circle marker icons for drawing vertices — no default red map
 * pins. The start point renders larger and primary-filled once the polygon
 * has enough points to close, inviting the click that completes it.
 */
function vertexIcon(kind: "normal" | "start-inactive" | "start-active"): google.maps.Icon {
  const svg =
    kind === "start-active"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8.5" fill="#4F7CFF" stroke="white" stroke-width="2.5"/></svg>`
      : kind === "start-inactive"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5" fill="white" stroke="#4F7CFF" stroke-width="2.5"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="4" fill="white" stroke="#8B9BFF" stroke-width="2"/></svg>`;
  const size = kind === "start-active" ? 22 : kind === "start-inactive" ? 14 : 12;
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}

/* -------------------------------------------------------------------------- */
/*                               CITIES PANEL                                 */
/* -------------------------------------------------------------------------- */
// A distinct concern from geofencing below (which cities are we live in, vs.
// where are the drawn zones) — unchanged by the zone-management redesign.

function CitiesPanel() {
  const { data: cities = [] } = useCities();
  const create = useCreateCity();
  const update = useUpdateCity();
  const remove = useDeleteCity();
  const [cityName, setCityName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = () => {
    const val = cityName.trim();
    if (!val) return;
    setErrorMsg("");
    create.mutate(
      { name: val },
      {
        onSuccess: () => setCityName(""),
        onError: (err: any) =>
          setErrorMsg(err?.message || "Failed to create city"),
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      <GlassCard>
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">
            Serviceable Cities
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Add and manage serviceable cities. Disabling a city pauses service
          across all its geofenced zones.
        </p>

        {errorMsg && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              City Name
            </label>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Type city name (e.g. Bengaluru, Mumbai, Pune)"
              className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-primary/50"
            />
          </div>
          <div className="flex flex-col">
            <span className="hidden sm:block mb-1.5 text-xs font-medium opacity-0 select-none">
              Action
            </span>
            <Button
              onClick={submit}
              disabled={create.isPending || !cityName.trim()}
              className="h-12 rounded-2xl px-5 shrink-0">
              <Plus className="size-4" /> Add City
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {cities.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3">
              <div>
                <p
                  className={`text-sm font-semibold ${c.active ? "text-ink" : "text-muted line-through"}`}>
                  {c.name}
                </p>
                <p className="text-xs text-muted">
                  {c.active
                    ? "Accepting bookings & active zones"
                    : "Deactivated"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: c.id, active: !c.active })}
                  className={c.active ? "text-ink" : "text-muted"}>
                  {c.active ? "Active" : "Inactive"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete city "${c.name}"? Remove its zones first.`,
                      )
                    ) {
                      remove.mutate(c.id, {
                        onError: (err: any) =>
                          setErrorMsg(err?.message || "Failed to delete city"),
                      });
                    }
                  }}
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {cities.length === 0 && (
            <p className="text-sm text-muted">No cities added yet.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN LOCATIONS PAGE                             */
/* -------------------------------------------------------------------------- */

export function Locations() {
  const [activeTab, setActiveTab] = useState<"zones" | "cities">("zones");

  // Server Queries & Mutations. `cities` here is only for the tab button's
  // count — React Query dedupes this against CitiesPanel's own call, so it's
  // not an extra request. Zone management below no longer depends on cities.
  const { data: cities = [] } = useCities();
  const { data: zones = [], isLoading: loadingZones } = useZones();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();

  // Selected Zone for Configure Panel (null = list mode)
  const [selectedZone, setSelectedZone] = useState<
    | (Partial<ServiceZone> & {
        coordinates?: [number, number][];
        isNew?: boolean;
      })
    | null
  >(null);

  // Boundary editing state on map
  const [isBoundaryEditing, setIsBoundaryEditing] = useState(false);
  const [liveVertexCount, setLiveVertexCount] = useState(0);

  // Drawing mode: null (off) | "polygon" (click-to-place active). The zone
  // only completes when the user closes the loop back on the start point —
  // never on a click elsewhere — so the placed-but-unclosed vertices live
  // here, not as a Google DrawingManager overlay.
  const [drawingMode, setDrawingMode] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);
  // Live rubber-band segment from the last placed point to the cursor —
  // updated via rAF (see handleMapMouseMove) so it can't flood React with a
  // state update on every pixel of mouse movement.
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ lat: number; lng: number } | null>(null);

  // Search filter for zone list
  const [zoneSearch, setZoneSearch] = useState("");

  // Feedback toast banner
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const showToast = (
    text: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Google Map refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const editPolygonRef = useRef<google.maps.Polygon | null>(null);
  const originalCoordsRef = useRef<[number, number][] | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // A do-nothing OverlayView, kept alive for the map's whole lifetime purely to
  // get a MapCanvasProjection out of it (Google doesn't expose pixel<->LatLng
  // conversion on the Map object directly — an attached OverlayView is the
  // documented way to get one). See the drawing-click effect below for why.
  const projectionOverlayRef = useRef<google.maps.OverlayView | null>(null);

  // Load Google Maps SDK
  const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // Agents currently, live, inside the selected existing zone
  const { data: liveZoneAgents = [] } = useZoneAgents(
    selectedZone && !selectedZone.isNew && selectedZone.id
      ? selectedZone.id
      : null,
  );

  // Pan map to zone
  const panToZone = useCallback((zone: Partial<ServiceZone>) => {
    if (!mapRef.current) return;
    const coords = getCoords(zone);
    const center = computeCenter(coords);
    mapRef.current.panTo(center);
    mapRef.current.setZoom(14);
  }, []);

  // Filtered zones list — search by name only, zones aren't grouped by city here.
  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return zones;
    const q = zoneSearch.trim().toLowerCase();
    return zones.filter((z) => z.name.toLowerCase().includes(q));
  }, [zones, zoneSearch]);

  // Open Configure Panel in Edit Details mode
  const handleEditDetails = (zone: ServiceZone) => {
    setDrawingMode(null);
    const coords = getCoords(zone);
    originalCoordsRef.current = JSON.parse(JSON.stringify(coords));
    setSelectedZone({
      ...zone,
      coordinates: coords,
      isNew: false,
    });
    setLiveVertexCount(coords.length > 1 ? coords.length - 1 : coords.length);
    setIsBoundaryEditing(false);
    panToZone(zone);
  };

  // Open Configure Panel with interactive boundary reshaping enabled immediately
  const handleEditBoundary = (zone: ServiceZone) => {
    setDrawingMode(null);
    const coords = getCoords(zone);
    originalCoordsRef.current = JSON.parse(JSON.stringify(coords));
    setSelectedZone({
      ...zone,
      coordinates: coords,
      isNew: false,
    });
    setLiveVertexCount(coords.length > 1 ? coords.length - 1 : coords.length);
    if (coords.length >= 3) {
      setIsBoundaryEditing(true);
      panToZone(zone);
      showToast(
        "Interactive boundary editing enabled. Drag vertex handles on map to reshape.",
        "info",
      );
    } else {
      setIsBoundaryEditing(false);
      panToZone(zone);
      showToast(
        "No polygon boundary set for this zone yet. Use 'Draw New Zone' to draw one.",
        "info",
      );
    }
  };

  // Extract edited coordinates from live Polygon instance
  const collectEditedCoords = useCallback((): [number, number][] | null => {
    if (!editPolygonRef.current || typeof editPolygonRef.current.getPath !== "function") return null;
    const path = editPolygonRef.current.getPath();
    if (!path || typeof path.getLength !== "function" || path.getLength() < 3) return null;
    const coords: [number, number][] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const pt = path.getAt(i);
      coords.push([pt.lng(), pt.lat()]);
    }
    // Close polygon
    coords.push([coords[0][0], coords[0][1]]);
    return coords;
  }, []);

  // Toggle boundary reshaping mode on the map
  const toggleBoundaryEditing = () => {
    if (!selectedZone) return;
    if (isBoundaryEditing) {
      const latest = collectEditedCoords();
      if (latest) {
        setSelectedZone((prev) =>
          prev ? { ...prev, coordinates: latest } : null,
        );
      }
      setIsBoundaryEditing(false);
      showToast(
        "Boundary shape pinned. Click 'Save All Changes' to persist.",
        "success",
      );
    } else {
      setIsBoundaryEditing(true);
      panToZone(selectedZone);
      showToast(
        "Drag vertex handles on map to reshape. Right-click vertex to delete.",
        "info",
      );
    }
  };

  // Reset boundary to initial coordinates
  const handleResetBoundary = () => {
    if (!originalCoordsRef.current || originalCoordsRef.current.length < 3)
      return;
    const restored = JSON.parse(JSON.stringify(originalCoordsRef.current));
    setSelectedZone((prev) =>
      prev ? { ...prev, coordinates: restored } : null,
    );
    setLiveVertexCount(
      restored.length > 1 ? restored.length - 1 : restored.length,
    );
    showToast("Boundary reset to initial coordinates", "info");
  };

  /**
   * Core click-to-place logic, driven by lat/lng + screen pixel — deliberately
   * NOT wired to GoogleMap's own onClick/onMouseDown. Google's Map class holds
   * back its own synthetic mouse events for some internal gesture-disambiguation
   * window (confirmed by testing: neither onClick nor onMouseDown escape it,
   * and disableDoubleClickZoom doesn't touch it either) — two clicks placed at
   * a normal quick pace, which is exactly how corners get drawn, can lose the
   * second one entirely. See the raw-DOM listener effect below, which bypasses
   * Maps' event system and calls this directly.
   *
   * Closing the loop is a proximity check here (screen pixels to the start
   * point) rather than the start Marker's own onClick, for the same reason —
   * relying on Maps' synthetic marker click for "close the loop" would still
   * be able to lose a quick tap.
   */
  const handleDrawSurfaceClick = useCallback(
    (lat: number, lng: number, pixel: { x: number; y: number }) => {
      if (!drawingMode) return;

      if (drawingPoints.length >= 3) {
        const projection = projectionOverlayRef.current?.getProjection();
        const start = drawingPoints[0];
        const startPixel = projection?.fromLatLngToContainerPixel(new window.google.maps.LatLng(start.lat, start.lng));
        if (startPixel && Math.hypot(pixel.x - startPixel.x, pixel.y - startPixel.y) <= CLOSE_LOOP_HIT_RADIUS_PX) {
          finishDrawing();
          return;
        }
      }

      const candidate: [number, number] = [lng, lat];
      const openRing: [number, number][] = drawingPoints.map((p) => [p.lng, p.lat]);
      if (wouldSelfIntersect(openRing, candidate)) {
        showToast(
          "That point would cross a line you've already drawn — pick a spot that doesn't cross the boundary.",
          "error",
        );
        return;
      }
      setDrawingPoints((prev) => [...prev, { lat, lng }]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawingMode, drawingPoints],
  );

  // Bypasses @react-google-maps/api's onClick/onMouseDown entirely (see
  // handleDrawSurfaceClick's comment) — and bypasses google.maps.event
  // altogether, not just React's wrapper. Confirmed by testing: a listener
  // added directly to the map's own DOM surface (even capture-phase, even
  // that exact element) never fires either — Maps' own internal gesture
  // handling sits between it and document and stops the event first. A
  // capture-phase listener on document itself runs before that's possible,
  // since capture always proceeds top-down from document. Re-binds whenever
  // drawingPoints changes so the closure is never stale — a plain
  // addEventListener/removeEventListener cycle is cheap, unlike recreating
  // Maps overlays.
  useEffect(() => {
    if (!drawingMode) return;
    const map = mapRef.current;
    if (!map || !window.google) return;
    const mapDiv = map.getDiv();

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // Not a click on the map itself, or on this page's own controls
      // (search box, drawing banner, zoom/street-view/map-type buttons —
      // none of those should place a point).
      if (!mapDiv.contains(target)) return;
      if (target?.closest("[data-map-ui-overlay]")) return;
      if (target?.closest(".gmnoprint, .gm-control-active, button, input")) return;

      const projection = projectionOverlayRef.current?.getProjection();
      if (!projection) return;
      const rect = mapDiv.getBoundingClientRect();
      const point = new window.google.maps.Point(event.clientX - rect.left, event.clientY - rect.top);
      const latLng = projection.fromContainerPixelToLatLng(point);
      if (!latLng) return;
      handleDrawSurfaceClick(latLng.lat(), latLng.lng(), { x: point.x, y: point.y });
    };

    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [drawingMode, handleDrawSurfaceClick]);

  // Throttled cursor tracking for the rubber-band preview segment — coalesced
  // to one state update per animation frame so mousemove can't flood React.
  const handleMapMouseMove = (e: google.maps.MapMouseEvent) => {
    if (!drawingMode || drawingPoints.length === 0 || !e.latLng) return;
    pendingCursorRef.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    if (cursorRafRef.current != null) return;
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      setCursorPos(pendingCursorRef.current);
    });
  };

  const handleUndoPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  // Close the loop — the ONLY way a zone gets created. Fired by clicking the
  // start vertex again (or the "Close Loop" button, same action) once there
  // are at least 3 points.
  const finishDrawing = () => {
    if (drawingPoints.length < 3) return;
    const coordinates: [number, number][] = drawingPoints.map((p) => [p.lng, p.lat]);
    coordinates.push([coordinates[0][0], coordinates[0][1]]); // close the ring

    if (!isSimplePolygon(coordinates)) {
      showToast(
        "This shape crosses itself — undo the last point or start over to fix it before closing.",
        "error",
      );
      return;
    }

    // Overlap collision detection against existing zones
    if (window.google?.maps?.geometry?.poly) {
      const googlePath = coordinates.map(([lng, lat]) => new window.google.maps.LatLng(lat, lng));
      const existingPolys = zones.map((z) => {
        const p = getCoords(z).map((c) => ({ lat: c[1], lng: c[0] }));
        return new window.google.maps.Polygon({ paths: p });
      });
      const bounds = new window.google.maps.LatLngBounds();
      googlePath.forEach((pt) => bounds.extend(pt));
      const center = bounds.getCenter();
      const isOverlapping = existingPolys.some((existing) => {
        const centerIn = window.google.maps.geometry.poly.containsLocation(center, existing);
        const vertexIn = googlePath.some((v) => window.google.maps.geometry.poly.containsLocation(v, existing));
        return centerIn || vertexIn;
      });
      if (isOverlapping) {
        showToast(
          "Overlap detected! Zone intersects an existing service area.",
          "error",
        );
        return;
      }
    }

    setDrawingMode(null);
    setDrawingPoints([]);
    setCursorPos(null);

    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    originalCoordsRef.current = JSON.parse(JSON.stringify(coordinates));
    setSelectedZone({
      name: "New Service Zone",
      color,
      active: true,
      coordinates,
      isNew: true,
    });
    setLiveVertexCount(coordinates.length - 1);
    setIsBoundaryEditing(false);
    showToast(
      "New zone boundary created. Complete details below and save.",
      "success",
    );
  };

  // Place search autocomplete on map
  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place?.geometry?.location) {
        const loc = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        if (mapRef.current) {
          mapRef.current.panTo(loc);
          mapRef.current.setZoom(15);
        }
      }
    }
  };

  // Save Zone (Create or Update)
  const handleSaveZone = async () => {
    if (!selectedZone) return;
    const name = selectedZone.name?.trim();
    if (!name) {
      showToast("Zone name is required", "error");
      return;
    }

    let coords = selectedZone.coordinates || getCoords(selectedZone);
    if (isBoundaryEditing && editPolygonRef.current) {
      const latest = collectEditedCoords();
      if (latest && latest.length >= 4) {
        coords = latest;
      }
    }

    if (!coords || coords.length < 4) {
      showToast(
        "A valid boundary with at least 3 vertices is required",
        "error",
      );
      return;
    }

    const payload = {
      name,
      color: selectedZone.color || "#4F7CFF",
      coordinates: coords,
      active: selectedZone.active !== false,
    };

    try {
      if (selectedZone.isNew || !selectedZone.id) {
        await createZone.mutateAsync(payload);
        showToast(`Zone "${name}" created successfully`, "success");
      } else {
        await updateZone.mutateAsync({ id: selectedZone.id, ...payload });
        showToast(`Zone "${name}" updated successfully`, "success");
      }
      setSelectedZone(null);
      setIsBoundaryEditing(false);
    } catch (err: any) {
      showToast(err?.message || "Failed to save service zone", "error");
    }
  };

  // Delete Zone
  const handleDeleteZone = async (zone: ServiceZone) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${zone.name}"? Agents currently in it will fall back to the next-nearest zone for new job offers.`,
      )
    ) {
      return;
    }

    try {
      await deleteZone.mutateAsync(zone.id);
      showToast(`Zone "${zone.name}" deleted`, "success");
      if (selectedZone?.id === zone.id) {
        setSelectedZone(null);
        setIsBoundaryEditing(false);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to delete zone", "error");
    }
  };

  /* ------------------------------ Sub-Panels ------------------------------ */

  // Left Sidebar: Zone List
  const renderZoneList = () => (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b border-line shrink-0 bg-surface">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={zoneSearch}
            onChange={(e) => setZoneSearch(e.target.value)}
            placeholder="Search zones..."
            className="h-10 w-full rounded-xl border border-line bg-surface-muted/60 pl-9 pr-3 text-xs text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface"
          />
          {zoneSearch && (
            <button
              onClick={() => setZoneSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loadingZones ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <RefreshCw className="size-5 animate-spin mr-2" /> Loading zones...
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary mb-3">
              <MapPin className="size-6" />
            </div>
            <p className="font-semibold text-ink text-sm">
              No service zones found
            </p>
            <p className="text-xs text-muted mt-1 max-w-xs">
              {zoneSearch
                ? "Try searching with a different term."
                : "Click 'Draw New Zone' above to outline your first geofenced boundary on the map."}
            </p>
          </div>
        ) : (
          filteredZones.map((zone) => {
            const isSelected = selectedZone?.id === zone.id;
            const coords = getCoords(zone);
            const ptsCount =
              coords.length > 1 ? coords.length - 1 : coords.length;

            return (
              <div
                key={zone.id}
                onClick={() => panToZone(zone)}
                className={`group rounded-2xl border transition-all p-3.5 cursor-pointer ${
                  isSelected
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-line bg-surface hover:border-line hover:shadow-xs"
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-4 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: zone.color || "#4F7CFF" }}
                    />
                    <p className="font-semibold text-sm text-ink truncate">
                      {zone.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                      zone.active
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-slate-100 text-muted"
                    }`}>
                    {zone.active ? "Active" : "Off"}
                  </span>
                </div>

                {/* Zone metadata chips */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5">
                    <Layers className="size-3 text-primary" /> {ptsCount} pts
                  </span>
                  {zone.agentCount !== undefined && (
                    <span className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5">
                      <Users className="size-3 text-primary" />{" "}
                      {zone.agentCount} agent{zone.agentCount === 1 ? "" : "s"} now
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-3.5 pt-2.5 border-t border-line/60 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDetails(zone);
                    }}
                    className="flex-1 text-xs h-8">
                    <Edit2 className="size-3 mr-1" /> Edit Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditBoundary(zone);
                    }}
                    className="flex-1 text-xs h-8 text-primary hover:bg-primary/5 hover:border-primary/40">
                    <Layers className="size-3 mr-1" /> Reshape
                  </Button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteZone(zone);
                    }}
                    title="Delete Zone"
                    className="p-1.5 text-muted hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Left Sidebar: Configure Zone Panel
  const renderConfigurePanel = () => {
    if (!selectedZone) return null;
    const coords = selectedZone.coordinates || getCoords(selectedZone);
    const ptsCount =
      isBoundaryEditing && liveVertexCount
        ? liveVertexCount
        : coords.length > 1
          ? coords.length - 1
          : coords.length;

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-surface p-4 shrink-0">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              {selectedZone.isNew ? "New Service Zone" : "Configure Zone"}
            </h3>
            <p className="text-xs text-muted truncate max-w-[240px]">
              {selectedZone.name || "Boundary & Servicing"}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedZone(null);
              setIsBoundaryEditing(false);
            }}
            className="text-muted hover:text-ink rounded-lg p-1">
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Boundary Reshaping Controller Card */}
          <div
            className={`rounded-2xl border p-3.5 transition-all ${
              isBoundaryEditing
                ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20"
                : "border-line bg-surface"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    isBoundaryEditing ? "bg-primary animate-pulse" : "bg-muted"
                  }`}
                />
                <span className="text-xs font-semibold text-ink">
                  Boundary Shape ({ptsCount} Vertices)
                </span>
              </div>
              {originalCoordsRef.current && (
                <button
                  type="button"
                  onClick={handleResetBoundary}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink">
                  <RotateCcw className="size-3" /> Reset
                </button>
              )}
            </div>

            <p className="text-xs text-muted mb-3 leading-relaxed">
              {isBoundaryEditing
                ? "Drag vertex handles on the map to reshape. Drag midpoints to add vertices. Right-click vertex to delete."
                : "Click below to activate interactive handles and reshape this zone directly on the map."}
            </p>

            <Button
              variant={isBoundaryEditing ? "primary" : "outline"}
              size="sm"
              onClick={toggleBoundaryEditing}
              className="w-full text-xs h-9 justify-center">
              {isBoundaryEditing ? (
                <>
                  <CheckCircle className="size-3.5 mr-1.5" /> Pin Boundary Shape
                </>
              ) : (
                <>
                  <Layers className="size-3.5 mr-1.5 text-primary" /> Reshape On
                  Map
                </>
              )}
            </Button>
          </div>

          {/* 2. Zone Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Zone Name
            </label>
            <input
              type="text"
              value={selectedZone.name || ""}
              onChange={(e) =>
                setSelectedZone({ ...selectedZone, name: e.target.value })
              }
              placeholder="e.g. Indiranagar Central"
              className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-primary/50"
            />
          </div>

          {/* 3. Map Color */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted">
              Zone Display Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedZone.color || "#4F7CFF"}
                onChange={(e) =>
                  setSelectedZone({ ...selectedZone, color: e.target.value })
                }
                className="size-9 rounded-xl border border-line cursor-pointer p-0.5 shrink-0"
              />
              <div className="flex gap-1.5 flex-wrap">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setSelectedZone({ ...selectedZone, color: c })
                    }
                    className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor:
                        selectedZone.color === c ? "#1a1f36" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 4. Active Status Toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Service Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedZone({ ...selectedZone, active: true })
                }
                className={`h-10 rounded-xl text-xs font-semibold transition-all border ${
                  selectedZone.active !== false
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                    : "border-line bg-surface text-muted hover:bg-surface-muted"
                }`}>
                Live & Active
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedZone({ ...selectedZone, active: false })
                }
                className={`h-10 rounded-xl text-xs font-semibold transition-all border ${
                  selectedZone.active === false
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                    : "border-line bg-surface text-muted hover:bg-surface-muted"
                }`}>
                Inactive
              </button>
            </div>
          </div>

          {/* 5. Agents currently in this zone — live, not a stored assignment */}
          {!selectedZone.isNew && selectedZone.id && (
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" /> In this zone now (
                  {liveZoneAgents.length})
                </span>
              </div>
              {liveZoneAgents.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {liveZoneAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">
                          {agent.name}
                        </p>
                        <p className="text-[10px] text-muted">{agent.phone}</p>
                      </div>
                      <span
                        className={`size-2 rounded-full ${
                          agent.online ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        title={agent.online ? "Online" : "Offline"}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted">
                  No agents are currently inside this zone's boundary. Jobs
                  here fall through to the next-nearest zone.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 border-t border-line bg-surface p-4 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedZone(null);
              setIsBoundaryEditing(false);
            }}
            className="flex-1 h-11 rounded-2xl text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleSaveZone}
            disabled={createZone.isPending || updateZone.isPending}
            className="flex-1 h-11 rounded-2xl text-xs">
            <Save className="size-3.5 mr-1.5" /> Save Zone
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">
            Locations & Geofencing
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configure serviceable cities, draw geofence zones, and map agent
            coverage areas.
          </p>
        </div>

        {/* Tab Switcher & Primary Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-2xl border border-line bg-surface p-1 shadow-2xs">
            <button
              onClick={() => setActiveTab("zones")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "zones"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted hover:text-ink"
              }`}>
              Geofence Zones ({zones.length})
            </button>
            <button
              onClick={() => setActiveTab("cities")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "cities"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted hover:text-ink"
              }`}>
              Cities ({cities.length})
            </button>
          </div>

          {activeTab === "zones" && (
            <Button
              onClick={() => {
                setSelectedZone(null);
                setIsBoundaryEditing(false);
                setDrawingPoints([]);
                setCursorPos(null);
                setDrawingMode(drawingMode ? null : "polygon");
              }}
              variant={drawingMode ? "outline" : "primary"}
              className="h-11 rounded-2xl px-5 text-xs font-semibold shrink-0">
              {drawingMode ? (
                <>
                  <X className="size-4 mr-1" /> Cancel Drawing
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1" /> Draw New Zone
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Floating Global Toast */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)] text-xs font-medium transition-all ${
            toastMsg.type === "success"
              ? "bg-emerald-600 text-white"
              : toastMsg.type === "error"
                ? "bg-rose-600 text-white"
                : "bg-ink text-surface"
          }`}>
          {toastMsg.type === "success" && <CheckCircle className="size-4" />}
          {toastMsg.type === "error" && <AlertTriangle className="size-4" />}
          {toastMsg.type === "info" && <Info className="size-4" />}
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-2 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === "cities" ? (
        <CitiesPanel />
      ) : (
        <div
          className="flex flex-col lg:flex-row gap-5"
          style={{ height: "calc(100vh - 200px)", minHeight: "650px" }}>
          {/* Left Sidebar */}
          <div className="w-full lg:w-[400px] shrink-0 h-[45%] lg:h-full rounded-card border border-line bg-surface shadow-[var(--shadow-soft)] overflow-hidden order-2 lg:order-1">
            {selectedZone ? renderConfigurePanel() : renderZoneList()}
          </div>

          {/* Right Map Panel */}
          <div className="w-full lg:flex-1 h-[55%] lg:h-full rounded-card border border-line bg-surface shadow-[var(--shadow-soft)] overflow-hidden relative order-1 lg:order-2">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={12}
                onMouseMove={handleMapMouseMove}
                onLoad={(map) => {
                  mapRef.current = map;
                  // Do-nothing OverlayView kept alive for pixel<->LatLng
                  // conversion — see handleDrawSurfaceClick's comment.
                  if (!projectionOverlayRef.current) {
                    const helper = new window.google.maps.OverlayView();
                    helper.onAdd = () => {};
                    helper.draw = () => {};
                    helper.onRemove = () => {};
                    helper.setMap(map);
                    projectionOverlayRef.current = helper;
                  }
                  if (zones.length > 0) {
                    const firstCoords = getCoords(zones[0]);
                    if (firstCoords.length > 0) {
                      map.panTo(computeCenter(firstCoords));
                    }
                  }
                }}
                options={{
                  disableDefaultUI: false,
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  draggableCursor: drawingMode ? "crosshair" : undefined,
                  clickableIcons: false,
                  // Two clicks placed close together (in position or timing) —
                  // exactly the normal rhythm of placing polygon corners — are
                  // otherwise indistinguishable from a double-click, and the
                  // browser/Maps API swallows the second one as a zoom gesture
                  // instead of delivering it as a click. Off for the whole
                  // session rather than toggled per drawingMode: reshaping an
                  // existing boundary (isBoundaryEditing) drags vertices with
                  // the same rhythm and needs the same protection, and losing
                  // double-click-to-zoom costs nothing — the +/- controls and
                  // scroll-to-zoom still work.
                  disableDoubleClickZoom: true,
                }}>
                {/* Autocomplete Search Overlay */}
                <Autocomplete
                  onLoad={(ac) => (autocompleteRef.current = ac)}
                  onPlaceChanged={handlePlaceChanged}>
                  <div data-map-ui-overlay className="absolute top-4 left-4 z-30 w-72">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        placeholder="Search location on map..."
                        className="h-11 w-full rounded-2xl border border-line bg-surface/95 pl-10 pr-4 text-xs text-ink outline-none shadow-lift backdrop-blur-md transition-all focus:border-primary focus:bg-surface"
                      />
                    </div>
                  </div>
                </Autocomplete>

                {/* Drawing Mode Active Overlay Banner */}
                {drawingMode && (
                  <div data-map-ui-overlay className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-surface/95 px-5 py-3 shadow-[var(--shadow-lift)] backdrop-blur-md">
                      <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Plus className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink">
                            Drawing Zone Boundary
                          </p>
                          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {drawingPoints.length} point{drawingPoints.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted">
                          {drawingPoints.length >= 3
                            ? "Click the filled start point to close the loop"
                            : "Click the map to place corners (min 3 points)"}
                        </p>
                      </div>
                      {drawingPoints.length > 0 && (
                        <button
                          onClick={handleUndoPoint}
                          className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-surface-muted transition-all cursor-pointer">
                          Undo
                        </button>
                      )}
                      {drawingPoints.length >= 3 && (
                        <button
                          onClick={finishDrawing}
                          className="rounded-xl bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-soft transition-all shadow-xs cursor-pointer">
                          Close Loop
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDrawingMode(null);
                          setDrawingPoints([]);
                          setCursorPos(null);
                        }}
                        className="rounded-xl bg-ink px-3 py-1.5 text-[11px] font-semibold text-surface hover:bg-ink-soft transition-all cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Boundary Reshaping Active Floating Banner */}
                {isBoundaryEditing && selectedZone && (
                  <div data-map-ui-overlay className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-ink px-5 py-3 text-surface shadow-[var(--shadow-lift)] backdrop-blur-md">
                      <div className="grid size-8 place-items-center rounded-xl bg-primary text-white">
                        <Edit2 className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-surface">
                            Reshaping: {selectedZone.name || "Zone"}
                          </p>
                          <span className="rounded-md bg-white/20 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            {liveVertexCount} vertices
                          </span>
                        </div>
                        <p className="text-[10px] text-surface/70 mt-0.5">
                          Drag points · Drag midpoints to add · Right-click
                          point to delete
                        </p>
                      </div>
                      <button
                        onClick={toggleBoundaryEditing}
                        className="ml-2 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-soft transition-all shadow-xs cursor-pointer">
                        Done Reshaping
                      </button>
                    </div>
                  </div>
                )}

                {/* Click-to-place drawing: small circle markers (no default map
                    pins), a live segment following the cursor, and a filled
                    preview once there are enough points to close. The zone is
                    only created by closing the loop — see finishDrawing. */}
                {drawingMode && drawingPoints.length > 0 && (
                  <>
                    {drawingPoints.map((pt, idx) => {
                      // A Marker is clickable by default regardless of whether
                      // it does anything on click, and its hit-area extends
                      // past the tiny custom icon — a real problem here, since
                      // placing the next corner *near* an existing one is the
                      // normal way to draw a zone, and Google Maps overlay
                      // clicks don't bubble to the map underneath (same reason
                      // the existing-zone Polygon has to forward clicks in
                      // drawingMode below). Only the start point, and only
                      // once it actually does something (closing the loop
                      // needs 3+ points), should be able to intercept a click.
                      const canClose = idx === 0 && drawingPoints.length >= 3;
                      return (
                        <Marker
                          key={`draw-pt-${idx}`}
                          position={pt}
                          clickable={canClose}
                          icon={vertexIcon(idx === 0 ? (canClose ? "start-active" : "start-inactive") : "normal")}
                          title={
                            canClose
                              ? "Click to close the loop and create this zone"
                              : idx === 0
                                ? "Start point"
                                : `Point ${idx + 1}`
                          }
                          onClick={() => {
                            if (canClose) finishDrawing();
                          }}
                        />
                      );
                    })}

                    {/* Placed segments, plus a live rubber-band segment to the cursor */}
                    <Polyline
                      path={cursorPos ? [...drawingPoints, cursorPos] : drawingPoints}
                      options={{
                        strokeColor: "#4F7CFF",
                        strokeWeight: 2.5,
                        strokeOpacity: 0.9,
                      }}
                    />

                    {drawingPoints.length >= 3 && (
                      <Polygon
                        paths={drawingPoints}
                        options={{
                          fillColor: "#4F7CFF",
                          fillOpacity: 0.2,
                          strokeColor: "#4F7CFF",
                          strokeWeight: 2,
                          clickable: false,
                        }}
                      />
                    )}
                  </>
                )}

                {/* Render Existing Zones Polygons */}
                {zones.map((zone) => {
                  const isSelected = selectedZone?.id === zone.id;
                  const isEditing = isSelected && isBoundaryEditing;
                  const rawCoords =
                    isSelected && selectedZone?.coordinates
                      ? selectedZone.coordinates
                      : getCoords(zone);
                  const paths = toGooglePaths(rawCoords);

                  // Do not render Polygon if zone doesn't have a valid boundary with at least 3 vertices
                  if (!paths || paths.length < 3) {
                    return null;
                  }

                  return (
                    <Polygon
                      key={`${zone.id}-${isEditing ? "editing" : "static"}`}
                      paths={paths}
                      editable={isEditing}
                      draggable={false}
                      onLoad={(poly) => {
                        if (isEditing) {
                          editPolygonRef.current = poly;
                          const path =
                            poly && typeof poly.getPath === "function"
                              ? poly.getPath()
                              : null;
                          if (path && typeof path.getLength === "function") {
                            setLiveVertexCount(path.getLength());
                          }

                          const updateCount = () => {
                            if (poly && typeof poly.getPath === "function") {
                              const p = poly.getPath();
                              if (p && typeof p.getLength === "function") {
                                setLiveVertexCount(p.getLength());
                              }
                            }
                          };

                          const listeners: google.maps.MapsEventListener[] = [];
                          if (path && typeof path.addListener === "function") {
                            listeners.push(
                              path.addListener("insert_at", updateCount),
                              path.addListener("set_at", updateCount),
                              path.addListener("remove_at", updateCount),
                            );
                          }

                          if (poly && typeof poly.addListener === "function") {
                            listeners.push(
                              poly.addListener(
                                "rightclick",
                                (e: google.maps.PolyMouseEvent) => {
                                  if (e.vertex !== undefined && poly.getPath) {
                                    const currentPath = poly.getPath();
                                    if (
                                      currentPath &&
                                      typeof currentPath.getLength ===
                                        "function" &&
                                      currentPath.getLength() > 3
                                    ) {
                                      currentPath.removeAt(e.vertex);
                                      setLiveVertexCount(
                                        currentPath.getLength(),
                                      );
                                      showToast("Vertex removed", "info");
                                    } else {
                                      showToast(
                                        "A polygon must have at least 3 vertices",
                                        "error",
                                      );
                                    }
                                  }
                                },
                              ),
                            );
                          }

                          (poly as any)._listeners = listeners;
                        }
                      }}
                      onUnmount={(poly) => {
                        if ((poly as any)._listeners) {
                          (poly as any)._listeners.forEach((l: any) => {
                            if (l && typeof l.remove === "function") {
                              l.remove();
                            } else if (
                              window.google?.maps?.event?.removeListener
                            ) {
                              window.google.maps.event.removeListener(l);
                            }
                          });
                        }
                        if (isEditing && editPolygonRef.current === poly) {
                          editPolygonRef.current = null;
                        }
                      }}
                      options={{
                        fillColor: zone.color || "#4F7CFF",
                        fillOpacity: isSelected ? 0.35 : 0.18,
                        strokeColor: zone.color || "#4F7CFF",
                        strokeWeight: isEditing ? 3.5 : isSelected ? 3 : 2,
                        strokeOpacity: 0.9,
                        zIndex: isEditing ? 10 : isSelected ? 5 : 1,
                      }}
                      onClick={() => {
                        // The raw mousedown listener (see handleDrawSurfaceClick)
                        // is on the map's own surface and fires regardless of
                        // what's rendered on top, so drawing over an existing
                        // zone's fill already places a point there — this just
                        // has to stay out of the way and not also open that
                        // zone's edit panel mid-draw.
                        if (drawingMode) return;
                        if (!isBoundaryEditing) {
                          handleEditDetails(zone);
                        }
                      }}
                    />
                  );
                })}

                {/* Render Unsaved New Zone Polygon if in configure mode */}
                {selectedZone &&
                  selectedZone.isNew &&
                  selectedZone.coordinates &&
                  toGooglePaths(selectedZone.coordinates).length >= 3 && (
                    <Polygon
                      key={`new-zone-${isBoundaryEditing ? "editing" : "static"}`}
                      paths={toGooglePaths(selectedZone.coordinates)}
                      editable={isBoundaryEditing}
                      draggable={false}
                      onLoad={(poly) => {
                        if (isBoundaryEditing) {
                          editPolygonRef.current = poly;
                          const path =
                            poly && typeof poly.getPath === "function"
                              ? poly.getPath()
                              : null;
                          if (path && typeof path.getLength === "function") {
                            setLiveVertexCount(path.getLength());
                          }
                          const updateCount = () => {
                            if (poly && typeof poly.getPath === "function") {
                              const p = poly.getPath();
                              if (p && typeof p.getLength === "function") {
                                setLiveVertexCount(p.getLength());
                              }
                            }
                          };
                          if (path && typeof path.addListener === "function") {
                            path.addListener("insert_at", updateCount);
                            path.addListener("set_at", updateCount);
                            path.addListener("remove_at", updateCount);
                          }
                        }
                      }}
                      options={{
                        fillColor: selectedZone.color || "#4F7CFF",
                        fillOpacity: 0.35,
                        strokeColor: selectedZone.color || "#4F7CFF",
                        strokeWeight: 3.5,
                        strokeOpacity: 0.9,
                        zIndex: 10,
                      }}
                    />
                  )}
              </GoogleMap>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
                  <RefreshCw className="size-6 animate-spin" />
                </div>
                <p className="font-semibold text-ink text-sm">
                  Loading Google Maps...
                </p>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  Connecting to Google Maps services. Ensure your
                  VITE_GOOGLE_MAPS_KEY is active.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
