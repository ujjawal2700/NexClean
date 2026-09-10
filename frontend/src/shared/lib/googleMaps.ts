import type { Libraries } from "@react-google-maps/api";

export const GOOGLE_MAPS_LIBRARIES: Libraries = ["drawing", "places", "geometry"];

export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: "google-map-script",
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  libraries: GOOGLE_MAPS_LIBRARIES,
};

