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

/**
 * Fastest ground speed a cleaner's phone can credibly report between two
 * fixes. Anything above it is a spoofed GPS mock or a wildly wrong fix, and
 * accepting it would teleport their marker across the customer's live map and
 * poison the nearest-agent ranking.
 */
export const MAX_PLAUSIBLE_SPEED_KMH = 150;

/**
 * Ignore fixes below this jump. Consumer GPS drifts tens of metres while a
 * phone sits still, and dividing that drift by a sub-second gap produces
 * absurd speeds — so short hops are always accepted rather than judged.
 */
const MIN_JUDGED_MOVE_M = 100;

/**
 * Whether moving from `prev` to `next` in the elapsed time is physically
 * possible. Shared by every location entry point (heartbeat, going online, and
 * the live socket stream) so one definition of "impossible" governs all of them.
 */
export function isPlausibleMove(
  prev: LngLat | null | undefined,
  prevAt: Date | string | null | undefined,
  next: LngLat,
  now: number = Date.now(),
): boolean {
  if (!prev || prev.length !== 2 || !prevAt) return true;
  const elapsedSeconds = (now - new Date(prevAt).getTime()) / 1000;
  if (elapsedSeconds <= 0) return true;
  const distanceMeters = haversineMeters(prev, next);
  if (distanceMeters <= MIN_JUDGED_MOVE_M) return true;
  const speedKmH = distanceMeters / 1000 / (elapsedSeconds / 3600);
  return speedKmH <= MAX_PLAUSIBLE_SPEED_KMH;
}

/** Compass bearing in degrees (0 = north) from one point to another. */
export function bearingDegrees(from: LngLat, to: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
