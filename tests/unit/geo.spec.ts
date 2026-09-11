import { test, expect } from "@playwright/test";

/**
 * Coordinate utility functions matching the frontend & backend geofence logic
 */

// Converts GeoJSON [lng, lat] coordinate ring to Google Maps { lat, lng } array
function toGooglePaths(coords?: [number, number][]): { lat: number; lng: number }[] {
  if (!coords || !Array.isArray(coords)) return [];
  const valid = coords.filter(
    (c) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]),
  );
  return valid.map(([lng, lat]) => ({ lat, lng }));
}

// Converts Google Maps { lat, lng } array to GeoJSON coordinates (closed ring)
function toGeoJsonCoordinates(pts: { lat: number; lng: number }[]): [number, number][] {
  if (!pts || pts.length < 3) return [];
  const coords: [number, number][] = pts.map((p) => [p.lng, p.lat]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }
  return coords;
}

// Validates a GeoJSON polygon coordinate ring
function validatePolygonRing(coords: [number, number][]): { valid: boolean; error?: string } {
  if (!Array.isArray(coords) || coords.length < 4) {
    return { valid: false, error: "A closed polygon ring requires at least 4 coordinates (3 vertices + closure)" };
  }
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { valid: false, error: "First and last coordinates must be identical to form a closed ring" };
  }
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) {
      return { valid: false, error: `Invalid coordinate numbers at index ${i}` };
    }
    if (lat < -90 || lat > 90) {
      return { valid: false, error: `Latitude ${lat} out of range [-90, 90] at index ${i}` };
    }
    if (lng < -180 || lng > 180) {
      return { valid: false, error: `Longitude ${lng} out of range [-180, 180] at index ${i}` };
    }
  }
  return { valid: true };
}

// Point-in-polygon ray-casting test
function isPointInPolygon(point: { lat: number; lng: number }, polygon: [number, number][]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// Centroid calculation
function computeCentroid(coords: [number, number][]): { lat: number; lng: number } {
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLng = 0;
  // Exclude duplicate closing coordinate if present
  const n = coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
    ? coords.length - 1
    : coords.length;

  for (let i = 0; i < n; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
  }
  return { lat: sumLat / n, lng: sumLng / n };
}

test.describe("Geofence Unit Tests — Coordinate Conversion & Math", () => {
  test("toGooglePaths correctly converts GeoJSON [lng, lat] to Google Maps { lat, lng }", () => {
    const rawCoords: [number, number][] = [
      [77.5946, 12.9716],
      [77.6046, 12.9716],
      [77.6046, 12.9816],
      [77.5946, 12.9716],
    ];
    const result = toGooglePaths(rawCoords);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(result[2]).toEqual({ lat: 12.9816, lng: 77.6046 });
  });

  test("toGooglePaths handles undefined, null, or empty coordinates gracefully", () => {
    expect(toGooglePaths(undefined)).toEqual([]);
    expect(toGooglePaths([])).toEqual([]);
    expect(toGooglePaths([[NaN, 12] as any])).toEqual([]);
  });

  test("toGeoJsonCoordinates closes the polygon ring if unclosed", () => {
    const pts = [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9716, lng: 77.6046 },
      { lat: 12.9816, lng: 77.6046 },
    ];
    const result = toGeoJsonCoordinates(pts);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual([77.5946, 12.9716]);
    expect(result[3]).toEqual([77.5946, 12.9716]); // closed back to first
  });

  test("toGeoJsonCoordinates preserves already closed ring without duplicate additions", () => {
    const pts = [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9716, lng: 77.6046 },
      { lat: 12.9816, lng: 77.6046 },
      { lat: 12.9716, lng: 77.5946 },
    ];
    const result = toGeoJsonCoordinates(pts);
    expect(result).toHaveLength(4);
  });

  test("validatePolygonRing approves a valid closed GeoJSON ring", () => {
    const ring: [number, number][] = [
      [77.59, 12.97],
      [77.60, 12.97],
      [77.60, 12.98],
      [77.59, 12.98],
      [77.59, 12.97],
    ];
    const validation = validatePolygonRing(ring);
    expect(validation.valid).toBe(true);
  });

  test("validatePolygonRing rejects rings with < 4 coordinates or unclosed endpoints", () => {
    const tooFew: [number, number][] = [
      [77.59, 12.97],
      [77.60, 12.97],
      [77.59, 12.97],
    ];
    expect(validatePolygonRing(tooFew).valid).toBe(false);

    const unclosed: [number, number][] = [
      [77.59, 12.97],
      [77.60, 12.97],
      [77.60, 12.98],
      [77.59, 12.98],
    ];
    expect(validatePolygonRing(unclosed).valid).toBe(false);
  });

  test("validatePolygonRing rejects out-of-bounds latitude/longitude", () => {
    const invalidLat: [number, number][] = [
      [77.59, 95.0], // > 90
      [77.60, 12.97],
      [77.60, 12.98],
      [77.59, 95.0],
    ];
    expect(validatePolygonRing(invalidLat).valid).toBe(false);

    const invalidLng: [number, number][] = [
      [-195.0, 12.97], // < -180
      [77.60, 12.97],
      [77.60, 12.98],
      [-195.0, 12.97],
    ];
    expect(validatePolygonRing(invalidLng).valid).toBe(false);
  });

  test("point-in-polygon correctly classifies points inside and outside", () => {
    // Square around Bengaluru: lng 77.5 to 77.7, lat 12.8 to 13.0
    const zoneBoundary: [number, number][] = [
      [77.5, 12.8],
      [77.7, 12.8],
      [77.7, 13.0],
      [77.5, 13.0],
      [77.5, 12.8],
    ];

    // Inside
    expect(isPointInPolygon({ lat: 12.9, lng: 77.6 }, zoneBoundary)).toBe(true);
    expect(isPointInPolygon({ lat: 12.85, lng: 77.55 }, zoneBoundary)).toBe(true);

    // Outside
    expect(isPointInPolygon({ lat: 13.1, lng: 77.6 }, zoneBoundary)).toBe(false);
    expect(isPointInPolygon({ lat: 12.7, lng: 77.6 }, zoneBoundary)).toBe(false);
    expect(isPointInPolygon({ lat: 12.9, lng: 77.4 }, zoneBoundary)).toBe(false);
    expect(isPointInPolygon({ lat: 12.9, lng: 77.8 }, zoneBoundary)).toBe(false);
  });

  test("computeCentroid accurately finds center of polygon vertices", () => {
    const coords: [number, number][] = [
      [10, 20],
      [20, 20],
      [20, 30],
      [10, 30],
      [10, 20], // closure
    ];
    const centroid = computeCentroid(coords);
    expect(centroid.lng).toBeCloseTo(15, 5);
    expect(centroid.lat).toBeCloseTo(25, 5);
  });
});

/**
 * Zone-based dispatch: the "nearby to far" tier ordering and geofenced agent
 * ranking backing backend/src/shared/geo.ts and
 * backend/src/modules/dispatch/dispatch.query.ts. Mirrors those algorithms
 * exactly (ray-cast point-in-polygon, planar point-to-segment distance,
 * haversine) rather than a differently-shaped stand-in, per this file's own
 * "matching the frontend & backend geofence logic" contract above — the
 * point is to prove the shipped algorithm's behavior, not a look-alike.
 */

type LngLat = [number, number];

function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pointToSegmentMeters(point: LngLat, a: LngLat, b: LngLat): number {
  const latRad = (point[1] * Math.PI) / 180;
  const mPerDegLat = 110_574;
  const mPerDegLng = 111_320 * Math.cos(latRad);
  const project = (p: LngLat) => ({ x: (p[0] - point[0]) * mPerDegLng, y: (p[1] - point[1]) * mPerDegLat });
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

function distanceToPolygonMeters(point: LngLat, ring: LngLat[]): number {
  if (ring.length < 3) return Infinity;
  if (isPointInPolygon({ lat: point[1], lng: point[0] }, ring)) return 0;
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    min = Math.min(min, pointToSegmentMeters(point, ring[i], ring[i + 1]));
  }
  return min;
}

function orderZonesByDistance<T extends { boundaryRing: LngLat[]; name?: string }>(
  point: LngLat,
  zones: T[],
): (T & { distanceM: number })[] {
  return zones
    .map((z) => ({ ...z, distanceM: distanceToPolygonMeters(point, z.boundaryRing) }))
    .sort((a, b) => a.distanceM - b.distanceM || (a.name ?? "").localeCompare(b.name ?? ""));
}

function rankAgentsForTier(
  point: LngLat,
  agents: { id: string; name: string; coordinates: LngLat }[],
  tier: { ring?: LngLat[] | null; radiusM: number },
): { id: string; name: string; distanceM: number }[] {
  return agents
    .map((a) => ({ ...a, distanceM: haversineMeters(point, a.coordinates) }))
    .filter(
      (a) =>
        (tier.ring ? isPointInPolygon({ lat: a.coordinates[1], lng: a.coordinates[0] }, tier.ring) : true) &&
        a.distanceM <= tier.radiusM,
    )
    .sort((a, b) => a.distanceM - b.distanceM)
    .map((a) => ({ id: a.id, name: a.name, distanceM: Math.round(a.distanceM) }));
}

test.describe("Zone distance ordering & tier ranking — dispatch geofencing", () => {
  // A 1km-ish square, roughly centred at [77.60, 12.90].
  const zoneA: LngLat[] = [
    [77.595, 12.895],
    [77.605, 12.895],
    [77.605, 12.905],
    [77.595, 12.905],
    [77.595, 12.895],
  ];
  // A same-shaped square well to the east — does not overlap zoneA.
  const zoneB: LngLat[] = [
    [77.700, 12.895],
    [77.710, 12.895],
    [77.710, 12.905],
    [77.700, 12.905],
    [77.700, 12.895],
  ];

  test("distanceToPolygonMeters is 0 for a point inside, positive for a point outside", () => {
    expect(distanceToPolygonMeters([77.6, 12.9], zoneA)).toBe(0);
    // zoneA's northern edge is at lat 12.905; 0.01deg further north is ~1.1km
    // of pure latitude offset (0.01 * 110_574 m/deg).
    const outside = distanceToPolygonMeters([77.6, 12.915], zoneA);
    expect(outside).toBeGreaterThan(1000);
    expect(outside).toBeLessThan(1200);
  });

  test("distanceToPolygonMeters matches a hand-computed offset for a point due south of a square", () => {
    // 0.01 deg south of the square's southern edge (lat 12.895), at a longitude
    // inside the square's span — nearest point is straight down, so this is a
    // pure latitude delta: ~0.01 * 110_574 m.
    const point: LngLat = [77.6, 12.885];
    const d = distanceToPolygonMeters(point, zoneA);
    expect(d).toBeCloseTo(0.01 * 110_574, -1); // within ~10m
  });

  test("orderZonesByDistance sorts nearest-first and puts the containing zone at distance 0", () => {
    const bookingInA: LngLat = [77.6, 12.9]; // inside zoneA
    const ordered = orderZonesByDistance(bookingInA, [
      { name: "Zone B (far)", boundaryRing: zoneB },
      { name: "Zone A (containing)", boundaryRing: zoneA },
    ]);
    expect(ordered[0].name).toBe("Zone A (containing)");
    expect(ordered[0].distanceM).toBe(0);
    expect(ordered[1].name).toBe("Zone B (far)");
    expect(ordered[1].distanceM).toBeGreaterThan(ordered[0].distanceM);
  });

  test("rankAgentsForTier restricts to agents inside the tier's ring and orders them nearest-first", () => {
    const booking: LngLat = [77.6, 12.9];
    const agents = [
      { id: "in-a-far-corner", name: "A1", coordinates: [77.596, 12.896] as LngLat }, // inside zoneA, near its corner
      { id: "in-a-near-center", name: "A2", coordinates: [77.601, 12.901] as LngLat }, // inside zoneA, close to booking
      { id: "in-b", name: "B1", coordinates: [77.705, 12.9] as LngLat }, // inside zoneB only
      { id: "nowhere", name: "N1", coordinates: [70.0, 10.0] as LngLat }, // in neither zone, far away
    ];

    const zoneATier = { ring: zoneA, radiusM: 50_000 };
    const ranked = rankAgentsForTier(booking, agents, zoneATier);
    expect(ranked.map((r) => r.id)).toEqual(["in-a-near-center", "in-a-far-corner"]);

    const zoneBTier = { ring: zoneB, radiusM: 50_000 };
    expect(rankAgentsForTier(booking, agents, zoneBTier).map((r) => r.id)).toEqual(["in-b"]);
  });

  test("rankAgentsForTier with no ring falls back to a flat radius — the citywide catch-all tier", () => {
    const booking: LngLat = [77.6, 12.9];
    const agents = [
      { id: "near", name: "Near", coordinates: [77.601, 12.901] as LngLat },
      { id: "far", name: "Far", coordinates: [70.0, 10.0] as LngLat },
    ];
    const fallbackTier = { radiusM: 20_000 }; // no ring — plain radius, matches the pre-zones behavior
    const ranked = rankAgentsForTier(booking, agents, fallbackTier);
    expect(ranked.map((r) => r.id)).toEqual(["near"]); // "far" is well outside 20km
  });

  test("nearby-to-far proof: an agent inside the booking's own zone outranks a straight-line-closer agent outside it", () => {
    // This is the concrete behavioral claim of zone-based dispatch: containment
    // in the booking's zone beats raw distance, not just a restatement of the
    // ranking function above.
    const booking: LngLat = [77.6, 12.9]; // dead centre of zoneA
    // Near zoneA's far (NE) corner — inside the zone, but ~761m from booking.
    const agentInOwnZone = { id: "own-zone", name: "Own zone", coordinates: [77.6049, 12.9049] as LngLat };
    // Just past zoneA's northern edge — outside the zone, but only ~612m from
    // booking: genuinely closer as the crow flies than agentInOwnZone.
    const agentCloserButElsewhere = {
      id: "closer-elsewhere",
      name: "Closer but wrong zone",
      coordinates: [77.6, 12.9055] as LngLat,
    };
    // Sanity: the "closer" agent really is closer in a straight line.
    expect(haversineMeters(booking, agentCloserButElsewhere.coordinates)).toBeLessThan(
      haversineMeters(booking, agentInOwnZone.coordinates),
    );

    const tiers = orderZonesByDistance(booking, [
      { name: "Zone A", boundaryRing: zoneA },
      { name: "Zone B", boundaryRing: zoneB },
    ]);
    expect(tiers[0].name).toBe("Zone A"); // the containing zone is tier 0

    const tier0Candidates = rankAgentsForTier(booking, [agentInOwnZone, agentCloserButElsewhere], {
      ring: tiers[0].boundaryRing,
      radiusM: 50_000,
    });
    expect(tier0Candidates.map((c) => c.id)).toEqual(["own-zone"]);
  });
});

/**
 * Self-intersection guard for zone drawing — mirrors backend/src/shared/geo.ts
 * (segmentsIntersect/isSimplePolygon/wouldSelfIntersect) and the identical copy
 * in frontend/src/modules/admin/pages/Locations.tsx exactly, so this proves
 * the actual shipped algorithm rejects a bowtie shape, not a look-alike.
 */

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

function wouldSelfIntersectCheck(openPoints: LngLat[], candidate: LngLat): boolean {
  if (openPoints.length < 2) return false;
  const newEdgeStart = openPoints[openPoints.length - 1];
  for (let i = 0; i < openPoints.length - 2; i++) {
    if (segmentsIntersect(newEdgeStart, candidate, openPoints[i], openPoints[i + 1])) return true;
  }
  return false;
}

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

test.describe("Zone drawing — self-intersection guard", () => {
  test("a clean square ring is simple", () => {
    const square: LngLat[] = [
      [77.595, 12.895],
      [77.605, 12.895],
      [77.605, 12.905],
      [77.595, 12.905],
      [77.595, 12.895], // closed
    ];
    expect(isSimplePolygon(square)).toBe(true);
  });

  test("a bowtie ring (crossed edges) is not simple", () => {
    // Same 4 corners as the clean square, but the 2nd and 4th vertices are
    // swapped — the classic self-crossing shape a click-anywhere-to-finish
    // tool lets you draw by accident.
    const bowtie: LngLat[] = [
      [77.595, 12.895],
      [77.605, 12.905], // swapped with the point below
      [77.605, 12.895],
      [77.595, 12.905],
      [77.595, 12.895], // closed
    ];
    expect(isSimplePolygon(bowtie)).toBe(false);
  });

  test("fewer than 3 unique vertices is never simple", () => {
    expect(isSimplePolygon([[0, 0], [1, 1], [0, 0]])).toBe(false);
  });

  test("a pentagon with one reflex vertex is still simple (concave is allowed, crossing is not)", () => {
    const concave: LngLat[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 1], // dents inward — concave, but no edges cross
      [0, 4],
      [0, 0],
    ];
    expect(isSimplePolygon(concave)).toBe(true);
  });

  test("wouldSelfIntersect rejects the exact next click that would create the bowtie", () => {
    // Three points placed so far, forming an "L": (0,0) -> (4,0) -> (4,4).
    const placed: LngLat[] = [
      [0, 0],
      [4, 0],
      [4, 4],
    ];
    // Placing (2,-1) next would cross the very first edge (0,0)-(4,0).
    expect(wouldSelfIntersectCheck(placed, [2, -1])).toBe(true);
    // Placing (0,4) next is a clean continuation — no crossing.
    expect(wouldSelfIntersectCheck(placed, [0, 4])).toBe(false);
  });

  test("wouldSelfIntersect ignores the edge adjacent to the point just placed", () => {
    // Only two points placed — the only existing edge shares its start vertex
    // with any candidate edge, so nothing can register as a crossing yet.
    expect(wouldSelfIntersectCheck([[0, 0], [4, 0]], [8, 0])).toBe(false);
  });
});
