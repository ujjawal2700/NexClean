import { Schema } from "mongoose";

/**
 * A reusable GeoJSON Point sub-schema ([lng, lat] order, per GeoJSON spec).
 *
 * Left `undefined` by default so a document without coordinates is simply
 * absent from any 2dsphere index (2dsphere indexes ignore missing fields),
 * rather than failing insert with invalid geometry.
 */
export function geoPointSchema() {
  return new Schema(
    {
      type: { type: String, enum: ["Point"], default: "Point" },
      // [longitude, latitude]
      coordinates: { type: [Number], default: undefined },
    },
    { _id: false },
  );
}

export type LngLat = [number, number];

/** Build a GeoJSON Point from a lat/lng pair, or undefined if either is missing. */
export function toPoint(lat?: number | null, lng?: number | null): { type: "Point"; coordinates: LngLat } | undefined {
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return undefined;
  }
  return { type: "Point", coordinates: [lng, lat] };
}

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
