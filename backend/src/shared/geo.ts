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

/* --------------------------- polygon simplicity --------------------------- */
//
// A "simple" polygon is one whose edges don't cross themselves — the bowtie
// shape a click-anywhere-to-finish drawing tool can produce is not simple, and
// pointInPolygon's ray-cast (and therefore every dispatch/coverage query
// above) gives ill-defined results against one. Enforced both here (server
// authority — the API can't be used to smuggle one in) and mirrored in the
// admin drawing UI for immediate feedback while drawing.

type Orientation = 0 | 1 | 2; // 0 = colinear, 1 = clockwise, 2 = counter-clockwise

function orientation(p: LngLat, q: LngLat, r: LngLat): Orientation {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

/** Whether q lies on segment p→r, given p, q, r are already known colinear. */
function onSegment(p: LngLat, q: LngLat, r: LngLat): boolean {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
}

/** Whether segments p1→p2 and p3→p4 properly cross or touch (standard orientation test). */
export function segmentsIntersect(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
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

/**
 * Whether a closed GeoJSON ring (first point repeated as the last) has no
 * self-crossing edges. Edges that merely share a drawn vertex — every
 * consecutive pair, and the first/last edge at the closing point — are not
 * crossings and are skipped rather than flagged.
 */
export function isSimplePolygon(ring: LngLat[]): boolean {
  const n = ring.length - 1; // edge/unique-vertex count; ring[n] === ring[0]
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
 * Whether appending `candidate` after `openPoints` (a not-yet-closed run of
 * vertices, at least one point) would cross any edge already drawn. Used to
 * reject an invalid point the instant it's clicked, rather than only at the
 * end — the edge into the new point can only conflict with edges other than
 * the one immediately before it (which shares `openPoints`'s last vertex).
 */
export function wouldSelfIntersect(openPoints: LngLat[], candidate: LngLat): boolean {
  if (openPoints.length < 2) return false;
  const newEdgeStart = openPoints[openPoints.length - 1];
  // Every existing edge except the one ending at newEdgeStart (adjacent by
  // construction — it shares that vertex, not a crossing).
  for (let i = 0; i < openPoints.length - 2; i++) {
    if (segmentsIntersect(newEdgeStart, candidate, openPoints[i], openPoints[i + 1])) return true;
  }
  return false;
}
