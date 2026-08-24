import { useEffect, useState } from "react";
import { loadMaps, mapsAuthFailed, mapsReady, onMapsAuthFailure } from "@shared/lib/maps";

/**
 * Whether the Google Maps JS API is usable.
 *
 * `undefined` while the async script is still in flight, so callers can show a
 * skeleton instead of flashing the "maps unavailable" fallback and then
 * replacing it with a map a second later.
 *
 * Flips back to `false` if Google later rejects the key. That happens after the
 * API has loaded and a map has already been constructed, so this deliberately
 * keeps listening for the whole life of the component rather than resolving
 * once and trusting the answer forever.
 */
export function useGoogleMaps(): boolean | undefined {
  const [ready, setReady] = useState<boolean | undefined>(() => (mapsReady() ? true : undefined));

  useEffect(() => {
    let alive = true;

    const unsubscribe = onMapsAuthFailure(() => {
      if (alive) setReady(false);
    });

    if (!ready) {
      loadMaps().then((ok) => {
        if (alive) setReady(ok && !mapsAuthFailed());
      });
    }

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [ready]);

  return ready;
}
