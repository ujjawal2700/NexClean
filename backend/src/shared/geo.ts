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

/* ------------------------- geofence polygon math -------------------------- */
//
// Pure, DB-free geometry backing zone-based dispatch (see
// dispatch/dispatch.query.ts). Kept here rather than computed via a MongoDB
// $geoWithin query so the actual "which zone is this point in, and how far to
// the others" logic is directly unit-testable and doesn't depend on a
// specific Mongo query-combination behaving a certain way.

/**
 * Ray-casting point-in-polygon test against a GeoJSON outer ring (an array of
 * [lng, lat] pairs, first and last equal). Standard even-odd algorithm — exact
 * for the simple, non-self-intersecting polygons an admin draws on a map.
 */
export function pointInPolygon(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Point-to-segment distance in metres, via a local equirectangular projection
 * centred on `point`. Not a true geodesic — but at the neighbourhood scale a
 * drawn zone edge spans, the projection error is negligible, the same
 * trade-off this file already makes elsewhere (see isPlausibleMove).
 */
function pointToSegmentMeters(point: LngLat, a: LngLat, b: LngLat): number {
  const latRad = (point[1] * Math.PI) / 180;
  const mPerDegLat = 110_574;
  const mPerDegLng = 111_320 * Math.cos(latRad);
  const project = (p: LngLat) => ({
    x: (p[0] - point[0]) * mPerDegLng,
    y: (p[1] - point[1]) * mPerDegLat,
  });
  const P = { x: 0, y: 0 };
  const A = project(a);
  const B = project(b);
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * abx + (P.y - A.y) * aby) / lenSq));
  const cx = A.x + t * abx;
  const cy = A.y + t * aby;
  return Math.hypot(P.x - cx, P.y - cy);
}

/**
 * Distance in metres from `point` to a polygon: 0 when the point is inside
 * (or on the boundary of) the polygon, otherwise the distance to its nearest
 * edge. This is what orders zones "nearby to far" for dispatch — the
 * containing zone is always distance 0 and sorts first.
 */
export function distanceToPolygonMeters(point: LngLat, ring: LngLat[]): number {
  if (ring.length < 3) return Infinity;
  if (pointInPolygon(point, ring)) return 0;
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    min = Math.min(min, pointToSegmentMeters(point, ring[i], ring[i + 1]));
  }
  return min;
}

/**
 * Sort zones by distance from `point`, nearest first (the zone containing the
 * point, if any, always sorts to the front at distance 0). Ties — e.g. two
 * overlapping zones both containing the point — break by name for a
 * deterministic order.
 */
export function orderZonesByDistance<T extends { boundaryRing: LngLat[]; name?: string }>(
  point: LngLat,
  zones: T[],
): (T & { distanceM: number })[] {
  return zones
    .map((z) => ({ ...z, distanceM: distanceToPolygonMeters(point, z.boundaryRing) }))
    .sort((a, b) => a.distanceM - b.distanceM || (a.name ?? "").localeCompare(b.name ?? ""));
}
