import { loadMaps, mapsReady, type LatLng } from "./maps";

/**
 * Turning a GPS fix into address fields.
 *
 * Google returns a `formatted_address` string and a structured
 * `address_components` array. The string is tempting and wrong: splitting it on
 * commas puts whatever happens to sit in position 3 into "city", which differs
 * by country, by place type, and even between two pins on the same street. The
 * components array is typed — `locality` is always the city, `postal_code` is
 * always the PIN — so everything here reads from that instead.
 */

export type StructuredAddress = {
  /** Street number plus flat/unit, when Google knows them. */
  houseNo: string;
  /** Building, apartment complex or neighbourhood. */
  society: string;
  /** Road name, useful as a landmark hint. */
  street: string;
  city: string;
  pincode: string;
  /** The whole thing as one line, for display. */
  formatted: string;
};

type GeoComponent = { long_name: string; short_name: string; types: string[] };

/** First component matching any of the given types, in priority order. */
function pick(components: GeoComponent[], types: string[]): string {
  for (const type of types) {
    const hit = components.find((c) => c.types.includes(type));
    if (hit?.long_name) return hit.long_name;
  }
  return "";
}

function toStructured(result: {
  address_components?: GeoComponent[];
  formatted_address?: string;
}): StructuredAddress {
  const components = result.address_components ?? [];

  // `subpremise` is the flat/unit; `street_number` the building number on the
  // road. Either alone is a usable "house no", and both together is better.
  const unit = pick(components, ["subpremise"]);
  const streetNumber = pick(components, ["street_number"]);
  const houseNo = [unit, streetNumber].filter(Boolean).join(", ");

  // A named building wins over the neighbourhood it sits in — it is the thing a
  // cleaner actually looks for on arrival.
  const society = pick(components, [
    "premise",
    "point_of_interest",
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
  ]);

  const street = pick(components, ["route"]);

  // `locality` is the city almost everywhere; the others are fallbacks for
  // places that do not report one (some Indian addresses report only the
  // district, which is what administrative_area_level_2 carries).
  const city = pick(components, [
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ]);

  return {
    houseNo,
    society,
    street,
    city,
    pincode: pick(components, ["postal_code"]),
    formatted: result.formatted_address ?? "",
  };
}

/**
 * Reverse-geocode a point into address fields.
 *
 * Resolves null rather than throwing when Maps is unavailable or the key is
 * rejected — the caller still has a perfectly good GPS pin and should let the
 * customer type the rest, not lose the pin to an error.
 */
export async function reverseGeocode(coords: LatLng): Promise<StructuredAddress | null> {
  const ready = mapsReady() ? true : await loadMaps();
  if (!ready || !window.google?.maps?.Geocoder) return null;

  return new Promise((resolve) => {
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: coords }, (results: unknown[], status: string) => {
        if (status !== "OK" || !Array.isArray(results) || results.length === 0) {
          resolve(null);
          return;
        }
        // Results run most-specific first, but a plain `plus_code` result
        // carries no useful components — prefer the first one that has a
        // street address or a building.
        const best =
          (results as { types?: string[] }[]).find((r) =>
            r.types?.some((t) => ["street_address", "premise", "subpremise"].includes(t)),
          ) ?? results[0];
        resolve(toStructured(best as Parameters<typeof toStructured>[0]));
      });
    } catch {
      resolve(null);
    }
  });
}

export type LocateFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export const LOCATE_MESSAGE: Record<LocateFailure, string> = {
  unsupported: "This browser can't share your location. Search for your address instead.",
  denied:
    "Location permission is blocked. Allow it in your browser's site settings, then try again.",
  unavailable: "Couldn't get a GPS fix. Check that location services are on.",
  timeout: "Getting your location took too long. Try again, or search for your address.",
};

/**
 * The device's current position, as a promise.
 *
 * `enableHighAccuracy` because this pin decides which parking bay a cleaner
 * walks to; a 500 m network-tower fix would be worse than useless. The 15s
 * timeout is deliberately generous — a cold GPS fix indoors genuinely takes
 * that long, and failing at 5s trains people to distrust the button.
 */
export function getCurrentPosition(): Promise<{ coords: LatLng; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject("unsupported" as LocateFailure);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject("denied" as LocateFailure);
        else if (err.code === err.TIMEOUT) reject("timeout" as LocateFailure);
        else reject("unavailable" as LocateFailure);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
