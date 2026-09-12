import type { Libraries } from "@react-google-maps/api";

// "drawing" backs the admin geofencing page's native polygon draw tool
// (DrawingManager) in Locations.tsx.
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places", "geometry", "drawing"];

export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: "google-map-script",
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  // Pinned: Google removed the DrawingManager (used by the admin geofencing
  // page's polygon draw tool) from the Maps JS API as of v3.65 — pinning to
  // the last version that still ships it avoids a runtime crash on load.
  // Same pin ezoflife's Geofence Management page uses for the same reason.
  version: "3.64",
  libraries: GOOGLE_MAPS_LIBRARIES,
};

