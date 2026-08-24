/**
 * Tunables for live agent tracking.
 *
 * Two separate cadences on purpose. A moving phone emits a GPS fix roughly
 * every second, and the two consumers of those fixes want opposite things:
 * the customer's map wants every one of them so the marker glides, while
 * MongoDB wants as few as possible — dispatch only reads the stored point when
 * ranking cleaners, where five seconds of staleness is invisible.
 */

/** Minimum gap between two broadcasts of the same agent's position. */
export const BROADCAST_THROTTLE_MS = Number(process.env.TRACKING_BROADCAST_MS ?? 1_000);

/** Minimum gap between two writes of the same agent's position to the database. */
export const PERSIST_THROTTLE_MS = Number(process.env.TRACKING_PERSIST_MS ?? 5_000);

/**
 * How long the agent→bookings lookup is reused before being re-read.
 *
 * Every GPS fix needs to know which booking rooms to broadcast into, and
 * querying for that on each fix would multiply one cheap socket message into a
 * database round-trip per second per online cleaner. The set only changes when
 * a job is assigned or finished, and both of those call `forgetAgentBookings`
 * directly — so the TTL is a backstop for missed invalidations, not the primary
 * mechanism.
 */
export const AGENT_BOOKINGS_TTL_MS = 30_000;

/**
 * Average city speed (km/h) used to quote an ETA when Google Directions is
 * unavailable. Deliberately pessimistic: an ETA that arrives early reads as a
 * pleasant surprise, one that slips reads as a broken promise.
 */
export const FALLBACK_SPEED_KMH = Number(process.env.TRACKING_FALLBACK_SPEED_KMH ?? 20);

/** Never quote less than this, so "1 min away" doesn't linger for five minutes. */
export const MIN_ETA_MINUTES = 2;

/** A stored fix older than this is treated as unknown rather than shown as live. */
export const LOCATION_STALE_MS = Number(process.env.TRACKING_STALE_MS ?? 120_000);
