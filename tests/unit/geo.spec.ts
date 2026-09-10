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
