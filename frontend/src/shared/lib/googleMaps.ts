import type { Libraries } from "@react-google-maps/api";

// "drawing" backs the admin geofencing page's native polygon draw tool
// (DrawingManager) in Locations.tsx.
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places", "geometry", "drawing"];

export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: "google-map-script",
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  libraries: GOOGLE_MAPS_LIBRARIES,
};

