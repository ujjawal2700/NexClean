import { useEffect, useState } from "react";

/**
 * One GPS watch for the whole agent app, shared by everything that needs it.
 *
 * Two things want the cleaner's position at the same time: the dispatch hook,
 * which streams it to the server, and the job map, which draws it. Each opening
 * its own `watchPosition` is wrong twice over. It doubles the GPS subscriptions
 * on a phone that is out in the field all day, which is real battery on the
 * device of someone who cannot stop to charge it. And it does not reliably
 * work: a second subscriber registering against an unchanged position may
 * simply never be called back, so the map sat on "Waiting for GPS…" forever
 * while the dispatch stream — registered first — was receiving fixes the whole
 * time.
 *
 * One watch, a cached last fix that late subscribers get immediately, and
 * reference counting so the hardware is released once nothing is listening.
 */

export type DeviceFix = {
  lat: number;
  lng: number;
  /** Degrees clockwise from north, when the device is moving fast enough to know. */
  heading: number | null;
  /** Metres per second, when reported. */
  speed: number | null;
  at: number;
};

type State = { fix: DeviceFix | null; error: string | null };

let watchId: number | null = null;
let latest: DeviceFix | null = null;
let lastError: string | null = null;
const subscribers = new Set<(state: State) => void>();

function publish() {
  const snapshot: State = { fix: latest, error: lastError };
  subscribers.forEach((fn) => fn(snapshot));
}

function describeError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "Location is off. Turn it on so the customer can see you coming.";
  }
  if (err.code === err.TIMEOUT) return "Still getting a GPS fix — check your signal.";
  return "Couldn't get a GPS fix — check your signal.";
}

function startWatch() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    lastError = "This device can't share its location.";
    publish();
    return;
  }

  const onFix = (pos: GeolocationPosition) => {
    lastError = null;
    latest = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      // A stationary device reports NaN or a stale bearing, which would spin
      // the marker at a standstill. Absent is more honest than wrong.
      heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
      speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
      at: Date.now(),
    };
    publish();
  };

  const onError = (err: GeolocationPositionError) => {
    lastError = describeError(err);
    publish();
  };

  const onInitialError = (err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      onError(err);
      return;
    }
    // Fallback to standard accuracy for desktop / laptop browsers without dedicated GPS hardware
    navigator.geolocation.getCurrentPosition(onFix, onError, {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 60_000,
    });
  };

  // An immediate read alongside the watch: `watchPosition` alone can take
  // seconds to produce its first callback, and the map should not sit empty
  // through that when a cached fix would do.
  navigator.geolocation.getCurrentPosition(onFix, onInitialError, {
    enableHighAccuracy: true,
    timeout: 8_000,
  });
  // maximumAge 0 — a fix cached from before this job started would put the
  // cleaner where they were, not where they are.
  watchId = navigator.geolocation.watchPosition(onFix, onInitialError, {
    enableHighAccuracy: true,
    maximumAge: 0,
  });
}

function stopWatchIfIdle() {
  if (subscribers.size > 0 || watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Test/teardown hook: forget the cached fix and release the hardware. */
export function resetDeviceLocation(): void {
  subscribers.clear();
  latest = null;
  lastError = null;
  stopWatchIfIdle();
}

/**
 * Subscribe to the shared GPS watch. Pass `enabled: false` to opt out without
 * unmounting — the watch stops once no one is listening.
 */
export function useDeviceLocation(enabled = true): State {
  const [state, setState] = useState<State>(() => ({ fix: latest, error: lastError }));

  useEffect(() => {
    if (!enabled) return;

    const listener = (next: State) => setState(next);
    subscribers.add(listener);
    startWatch();

    // A subscriber that arrives after the first fix has already landed gets it
    // straight away rather than waiting for the device to move.
    if (latest || lastError) listener({ fix: latest, error: lastError });

    return () => {
      subscribers.delete(listener);
      stopWatchIfIdle();
    };
  }, [enabled]);

  return state;
}
