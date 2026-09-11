/**
 * Tunables for the real-time dispatch engine.
 * Kept in one place so behaviour (offer timeout, search radii, cadence) can be
 * adjusted without touching engine logic.
 */

/** How long a single cleaner has to accept an offer before it moves on. */
export const OFFER_TTL_MS = Number(process.env.DISPATCH_OFFER_TTL_MS ?? 60_000);

/**
 * Search radii (metres). Dispatch starts at the first radius; once every
 * eligible cleaner inside it has declined/timed out, it widens to the next.
 * When the last radius is exhausted the job goes to the admin queue.
 */
export const SEARCH_RADII_M = (process.env.DISPATCH_RADII_M ?? "3000,6000,12000")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

/**
 * How many cleaners to offer a job to at once.
 * 1 = strict Uber-style sequential nearest-first (the chosen model).
 * Raise to offer a "wave" of the N nearest simultaneously.
 */
export const OFFER_BATCH = Number(process.env.DISPATCH_OFFER_BATCH ?? 1);

/** Max candidates to pull from a geo query per radius step. */
export const MAX_CANDIDATES = 25;

/**
 * Safety cap on how many eligible-agent documents a single dispatch attempt
 * will fetch before ranking them in JS (see dispatch.query.ts). Not a tuning
 * knob like the above — just a ceiling against a pathological fleet size.
 */
export const MAX_FETCHED_AGENTS = 500;

/** How often the sweeper checks for expired offers + due subscription washes. */
export const SWEEP_INTERVAL_MS = Number(process.env.DISPATCH_SWEEP_INTERVAL_MS ?? 2_000);

/** Lead time before a subscription wash's slot to auto-assign the nearest cleaner. */
export const SUBSCRIPTION_LEAD_MS = Number(
  process.env.DISPATCH_SUBSCRIPTION_LEAD_MS ?? 2 * 60 * 60 * 1000,
);

/** How often the worker checks for booking reminder windows (60/30/5 min out) that are due. */
export const REMINDER_TICK_MS = Number(process.env.DISPATCH_REMINDER_TICK_MS ?? 60_000);

export const MAX_SEARCH_RADIUS_M = SEARCH_RADII_M[SEARCH_RADII_M.length - 1] ?? 12_000;
