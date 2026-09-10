import { useState, useRef, useMemo, useCallback } from "react";
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

/* -------------------------------------------------------------------------- */
/*                               CITIES PANEL                                 */
/* -------------------------------------------------------------------------- */

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

  // Server Queries & Mutations
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

  // Drawing mode (null | 'polygon') and clicked vertices
  const [drawingMode, setDrawingMode] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);

  // Search filter for zone list
  const [zoneSearch, setZoneSearch] = useState("");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");

  // Pincode input & geocoding state
  const [newPincodeInput, setNewPincodeInput] = useState("");
  const [detectingPincodes, setDetectingPincodes] = useState(false);

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

  // Load Google Maps SDK
  const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // Assigned agents query for selected existing zone
  const { data: assignedAgents = [] } = useZoneAgents(
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

  // Filtered zones list
  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      const matchesSearch =
        !zoneSearch.trim() ||
        z.name.toLowerCase().includes(zoneSearch.toLowerCase()) ||
        z.cityName?.toLowerCase().includes(zoneSearch.toLowerCase()) ||
        z.pincodes?.some((p) => p.includes(zoneSearch.trim()));
      const matchesCity =
        selectedCityFilter === "all" || z.cityId === selectedCityFilter;
      return matchesSearch && matchesCity;
    });
  }, [zones, zoneSearch, selectedCityFilter]);

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

  // Auto-detect serviced pincodes using Google Maps Geocoder
  const handleAutoDetectPincodes = async () => {
    const coords =
      isBoundaryEditing && editPolygonRef.current
        ? collectEditedCoords()
        : selectedZone?.coordinates || getCoords(selectedZone);

    if (!coords || coords.length < 3) {
      showToast(
        "Boundary coordinates required to auto-detect pincodes",
        "error",
      );
      return;
    }

    if (!window.google?.maps?.Geocoder) {
      showToast("Google Maps Geocoder is not loaded", "error");
      return;
    }

    setDetectingPincodes(true);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const pts = coords.map((c) => new window.google.maps.LatLng(c[1], c[0]));
      const bounds = new window.google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      const center = bounds.getCenter();

      const sampleLocs = [center, ...pts.slice(0, Math.min(pts.length, 8))];
      const detected = new Set<string>(selectedZone?.pincodes || []);
      let newCount = 0;

      for (const loc of sampleLocs) {
        try {
          const resp: google.maps.GeocoderResult[] = await new Promise(
            (resolve) => {
              geocoder.geocode(
                { location: loc },
                (results: any, status: any) => {
                  if (status === "OK" && results) resolve(results);
                  else resolve([]);
                },
              );
            },
          );
          if (resp && resp[0]) {
            const comp = resp[0].address_components?.find((c) =>
              c.types.includes("postal_code"),
            );
            if (comp?.long_name && !detected.has(comp.long_name)) {
              detected.add(comp.long_name);
              newCount++;
            }
          }
        } catch (_) {}
      }

      setSelectedZone((prev) =>
        prev ? { ...prev, pincodes: Array.from(detected) } : null,
      );
      if (newCount > 0) {
        showToast(`Auto-detected ${newCount} new pincode(s)`, "success");
      } else {
        showToast("No new pincodes detected within this zone boundary", "info");
      }
    } catch (err: any) {
      showToast("Auto-detection failed: " + err.message, "error");
    } finally {
      setDetectingPincodes(false);
    }
  };

  // Add individual pincode manually
  const handleAddPincode = () => {
    const trimmed = newPincodeInput.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      showToast("Please enter a valid 6-digit pincode", "error");
      return;
    }
    const current = selectedZone?.pincodes || [];
    if (current.includes(trimmed)) {
      showToast("Pincode already added", "info");
      return;
    }
    setSelectedZone((prev) =>
      prev ? { ...prev, pincodes: [...current, trimmed] } : null,
    );
    setNewPincodeInput("");
  };

  const handleRemovePincode = (pin: string) => {
    setSelectedZone((prev) =>
      prev
        ? { ...prev, pincodes: (prev.pincodes || []).filter((p) => p !== pin) }
        : null,
    );
  };

  // Map click handler for custom polygon drawing
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!drawingMode || !e.latLng) return;
    const newPt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setDrawingPoints((prev) => [...prev, newPt]);
  };

  // Drawing finished: user completed drawing a new polygon on map
  const finishDrawing = async (pointsToComplete?: { lat: number; lng: number }[]) => {
    const pts = pointsToComplete || drawingPoints;
    if (!pts || pts.length < 3) {
      showToast("A zone requires at least 3 points to form a polygon", "error");
      return;
    }

    const coordinates: [number, number][] = [];
    const googlePath: google.maps.LatLng[] = [];

    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      coordinates.push([pt.lng, pt.lat]);
      googlePath.push(new window.google.maps.LatLng(pt.lat, pt.lng));
    }
    // Close polygon
    coordinates.push([coordinates[0][0], coordinates[0][1]]);

    // Overlap collision detection
    if (window.google?.maps?.geometry?.poly) {
      const existingPolys = zones.map((z) => {
        const p = getCoords(z).map((c) => ({ lat: c[1], lng: c[0] }));
        return new window.google.maps.Polygon({ paths: p });
      });

      const bounds = new window.google.maps.LatLngBounds();
      googlePath.forEach((pt) => bounds.extend(pt));
      const center = bounds.getCenter();

      const isOverlapping = existingPolys.some((existing) => {
        const centerIn = window.google.maps.geometry.poly.containsLocation(
          center,
          existing,
        );
        const vertexIn = googlePath.some((v) =>
          window.google.maps.geometry.poly.containsLocation(v, existing),
        );
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

    // Auto-detect initial pincode from center
    const pincodes = new Set<string>();
    if (window.google?.maps?.Geocoder) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const center = googlePath[0];
        const res: google.maps.GeocoderResult[] = await new Promise(
          (resolve) => {
            geocoder.geocode(
              { location: center },
              (results: any, status: any) => {
                if (status === "OK" && results) resolve(results);
                else resolve([]);
              },
            );
          },
        );
        if (res[0]) {
          const pc = res[0].address_components?.find((c) =>
            c.types.includes("postal_code"),
          );
          if (pc?.long_name) pincodes.add(pc.long_name);
        }
      } catch (_) {}
    }

    setDrawingMode(null);
    setDrawingPoints([]);

    const defaultCity = cities.find((c) => c.active) || cities[0];
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];

    originalCoordsRef.current = JSON.parse(JSON.stringify(coordinates));
    setSelectedZone({
      name: "New Service Zone",
      cityId: defaultCity?.id || "",
      cityName: defaultCity?.name || "",
      color,
      active: true,
      coordinates,
      pincodes: Array.from(pincodes),
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
    if (!selectedZone.cityId) {
      showToast("Please select a serviceable city", "error");
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
      cityId: selectedZone.cityId,
      color: selectedZone.color || "#4F7CFF",
      coordinates: coords,
      pincodes: selectedZone.pincodes || [],
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
        `Are you sure you want to delete "${zone.name}"? Any agents assigned to this zone will need reassignment.`,
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
      {/* Search & City Filter */}
      <div className="p-4 border-b border-line space-y-3 shrink-0 bg-surface">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={zoneSearch}
            onChange={(e) => setZoneSearch(e.target.value)}
            placeholder="Search zones, cities, pincodes..."
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

        {cities.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCityFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-all shrink-0 ${
                selectedCityFilter === "all"
                  ? "bg-primary text-white"
                  : "bg-surface-muted text-muted hover:text-ink"
              }`}>
              All Cities
            </button>
            {cities.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCityFilter(c.id)}
                className={`rounded-lg px-2.5 py-1 font-medium transition-all shrink-0 ${
                  selectedCityFilter === c.id
                    ? "bg-primary text-white"
                    : "bg-surface-muted text-muted hover:text-ink"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        )}
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
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink truncate">
                        {zone.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {zone.cityName || "No city linked"}
                      </p>
                    </div>
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
                      {zone.agentCount} agents
                    </span>
                  )}
                  {zone.pincodes && zone.pincodes.length > 0 && (
                    <span className="rounded-md bg-surface-muted px-2 py-0.5">
                      {zone.pincodes.length} PIN
                      {zone.pincodes.length > 1 ? "s" : ""}
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

          {/* 2. Zone Name & City */}
          <div className="space-y-3">
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

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                City
              </label>
              <select
                value={selectedZone.cityId || ""}
                onChange={(e) => {
                  const cityObj = cities.find((c) => c.id === e.target.value);
                  setSelectedZone({
                    ...selectedZone,
                    cityId: e.target.value,
                    cityName: cityObj ? cityObj.name : "",
                  });
                }}
                className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-primary/50">
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
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

          {/* 5. Serviced Pincodes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">
                Serviced Pincodes ({selectedZone.pincodes?.length || 0})
              </label>
              <button
                type="button"
                disabled={detectingPincodes}
                onClick={handleAutoDetectPincodes}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50">
                <RefreshCw
                  className={`size-3 ${detectingPincodes ? "animate-spin" : ""}`}
                />
                {detectingPincodes ? "Scanning..." : "Auto-Detect"}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={newPincodeInput}
                onChange={(e) =>
                  setNewPincodeInput(e.target.value.replace(/\D/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && handleAddPincode()}
                placeholder="6-digit PIN code"
                className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-primary/50"
              />
              <Button
                size="sm"
                onClick={handleAddPincode}
                className="h-10 px-4 rounded-xl text-xs">
                Add
              </Button>
            </div>

            {selectedZone.pincodes && selectedZone.pincodes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface-muted/50 p-2 max-h-32 overflow-y-auto">
                {selectedZone.pincodes.map((pin) => (
                  <span
                    key={pin}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-2xs">
                    {pin}
                    <button
                      type="button"
                      onClick={() => handleRemovePincode(pin)}
                      className="text-muted hover:text-rose-600 transition-colors">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted italic">
                No pincodes linked yet. Enter manually or click Auto-Detect.
              </p>
            )}
          </div>

          {/* 6. Assigned Agents in this Zone */}
          {!selectedZone.isNew && selectedZone.id && (
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" /> Assigned Agents (
                  {assignedAgents.length})
                </span>
              </div>
              {assignedAgents.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {assignedAgents.map((agent) => (
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
                  No agents servicing this zone yet. You can assign agents from
                  the Agents page.
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
                onClick={handleMapClick}
                onLoad={(map) => {
                  mapRef.current = map;
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
                  clickableIcons: false,
                  draggableCursor: drawingMode ? "crosshair" : undefined,
                }}>
                {/* Autocomplete Search Overlay */}
                <Autocomplete
                  onLoad={(ac) => (autocompleteRef.current = ac)}
                  onPlaceChanged={handlePlaceChanged}>
                  <div className="absolute top-4 left-4 z-30 w-72">
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
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
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
                          Click on map to place corners (min 3 points)
                        </p>
                      </div>
                      {drawingPoints.length > 0 && (
                        <button
                          onClick={() => setDrawingPoints((pts) => pts.slice(0, -1))}
                          className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-surface-muted transition-all cursor-pointer">
                          Undo
                        </button>
                      )}
                      {drawingPoints.length >= 3 && (
                        <button
                          onClick={() => finishDrawing(drawingPoints)}
                          className="rounded-xl bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-soft transition-all shadow-xs cursor-pointer">
                          Complete Zone
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDrawingMode(null);
                          setDrawingPoints([]);
                        }}
                        className="rounded-xl bg-ink px-3 py-1.5 text-[11px] font-semibold text-surface hover:bg-ink-soft transition-all cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Boundary Reshaping Active Floating Banner */}
                {isBoundaryEditing && selectedZone && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
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

                {/* Native Drawing Mode Live Renderers */}
                {drawingMode && drawingPoints.length > 0 && (
                  <>
                    {/* Vertex Markers */}
                    {drawingPoints.map((pt, idx) => (
                      <Marker
                        key={`draw-pt-${idx}`}
                        position={pt}
                        label={
                          idx === 0 && drawingPoints.length >= 3
                            ? {
                                text: "✓",
                                color: "#ffffff",
                                fontSize: "11px",
                                fontWeight: "bold",
                              }
                            : {
                                text: `${idx + 1}`,
                                color: "#ffffff",
                                fontSize: "10px",
                              }
                        }
                        title={
                          idx === 0 && drawingPoints.length >= 3
                            ? "Click to complete zone"
                            : `Point ${idx + 1}`
                        }
                        onClick={() => {
                          if (idx === 0 && drawingPoints.length >= 3) {
                            finishDrawing(drawingPoints);
                          }
                        }}
                      />
                    ))}

                    {/* Connecting Polyline */}
                    {drawingPoints.length >= 2 && (
                      <Polyline
                        path={drawingPoints}
                        options={{
                          strokeColor: "#4F7CFF",
                          strokeWeight: 2.5,
                          strokeOpacity: 0.9,
                        }}
                      />
                    )}

                    {/* Preview Polygon */}
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
                      onClick={(e) => {
                        if (drawingMode) {
                          handleMapClick(e);
                          return;
                        }
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
