import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { haversineMeters, bearingDegrees, isPlausibleMove, toPoint, type LngLat } from "../../shared/geo";
import {
  emitToRoom,
  emitToUser,
  emitToAdmins,
  broadcastToWorkers,
  evictUserFromRoom,
} from "../../shared/services/socket";
import {
  AGENT_BOOKINGS_TTL_MS,
  BROADCAST_THROTTLE_MS,
  FALLBACK_SPEED_KMH,
  LOCATION_STALE_MS,
  MIN_ETA_MINUTES,
  PERSIST_THROTTLE_MS,
} from "./tracking.config";

/**
 * Job statuses during which a booking has a cleaner physically travelling to
 * or standing at the customer — the window where a live map means anything.
 * `completed` is excluded so a finished job stops leaking the cleaner's
 * position to a customer who no longer has any reason to see it.
 */
export const TRACKABLE_JOB_STATUSES = ["assigned", "enroute", "arrived", "in_progress"] as const;

/** Socket room carrying one booking's live tracking events. */
export const bookingRoom = (bookingId: string): string => `booking:${bookingId}`;

export type LiveFix = {
  lat: number;
  lng: number;
  /** Compass degrees the marker should point, derived when the device omits it. */
  heading: number | null;
  /** Metres per second, when the device reports it. */
  speed: number | null;
  updatedAt: string;
};

/* --------------------------- in-memory hot state -------------------------- */

type AgentBookingsEntry = { ids: string[]; expiresAt: number };
type AgentFixEntry = { point: LngLat; at: number; heading: number | null; lastBroadcastAt: number; lastPersistAt: number };

/**
 * Per-process caches. Both are pure accelerators for data that also lives in
 * MongoDB, so a cold worker (or a restart) recovers by simply re-reading —
 * nothing here is a source of truth.
 *
 * Being per-process is NOT automatically safe under PM2 cluster mode: a stale
 * entry on the worker holding a cleaner's socket is invisible to the worker
 * that changed the underlying data. That is why invalidation goes through
 * `forgetAgentBookings`, which tells every worker, rather than a local delete.
 */
const agentBookingsCache = new Map<string, AgentBookingsEntry>();
const agentFixCache = new Map<string, AgentFixEntry>();

/**
 * Forget fixes nobody can still use.
 *
 * `agentFixCache` gains an entry for every agent who has ever streamed to this
 * worker and, without this, never loses one — a slow leak in a process that is
 * meant to stay up for weeks. Anything older than the staleness window is
 * already treated as unknown by every reader, so holding it costs memory and
 * buys nothing. Swept on write rather than on a timer: the map is only ever
 * touched from the ingest path, so that is the only place it can grow.
 */
let lastFixPruneAt = 0;

function pruneFixCache(now: number): void {
  // Rate-limited by time, not just by size. A size-only guard scans the whole
  // map on EVERY fix once it crosses the threshold — with a few hundred online
  // cleaners each reporting every second, that is hundreds of comparisons per
  // fix, hundreds of times a second, to free almost nothing. The map only grows
  // by one entry per newly-seen agent, so a sweep this infrequent is ample.
  if (agentFixCache.size < 200) return;
  if (now - lastFixPruneAt < LOCATION_STALE_MS) return;
  lastFixPruneAt = now;
  for (const [agentId, entry] of agentFixCache) {
    if (now - entry.at > LOCATION_STALE_MS) agentFixCache.delete(agentId);
  }
}

/** Cross-worker cache-invalidation signal. */
export const FORGET_AGENT_EVENT = "tracking:forget-agent";

/** Drop this worker's cached booking set for an agent. */
export function forgetAgentBookingsLocal(agentId?: string | null): void {
  if (!agentId) return;
  agentBookingsCache.delete(String(agentId));
}

/**
 * Drop EVERY worker's cached booking set for an agent.
 *
 * Must be fleet-wide, not local. The cleaner's socket is pinned to one worker
 * for its lifetime, while the request that assigns or ends their job lands on
 * whichever worker the load balancer picked — so the process that needs to
 * learn the set changed is precisely the one that did not handle the change.
 * A local-only delete leaves the socket-holding worker streaming against a
 * stale set: no fixes at all for a newly assigned job, and fixes still flowing
 * into a finished one, both until the TTL happens to expire.
 */
export function forgetAgentBookings(agentId?: string | null): void {
  if (!agentId) return;
  forgetAgentBookingsLocal(agentId);
  broadcastToWorkers(FORGET_AGENT_EVENT, String(agentId));
}

/**
 * Revoke an agent's access to one booking's live feed.
 *
 * Called whenever a job stops being theirs. Without it, the socket they joined
 * with stays in the room and keeps receiving the replacement cleaner's position
 * and the customer's progress — a check performed only on the way in is a
 * turnstile, not authorization.
 */
export function revokeAgentTracking(agentId?: string | null, bookingId?: string | null): void {
  if (!agentId || !bookingId) return;
  evictUserFromRoom(String(agentId), bookingRoom(String(bookingId)));
}

/** Test/shutdown hook: wipe every cached tracking fact. */
export function resetTrackingCaches(): void {
  agentBookingsCache.clear();
  agentFixCache.clear();
  lastFixPruneAt = 0;
}

/** Booking ids this agent is currently mid-job on, cached briefly. */
async function activeBookingIds(agentId: string): Promise<string[]> {
  const cached = agentBookingsCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;

  const rows = await Booking.find({
    assignedAgent: agentId,
    status: "upcoming",
    jobStatus: { $in: TRACKABLE_JOB_STATUSES },
  })
    .select("_id")
    .lean();

  const ids = rows.map((r) => String(r._id));
  agentBookingsCache.set(agentId, { ids, expiresAt: Date.now() + AGENT_BOOKINGS_TTL_MS });
  return ids;
}

/* ------------------------------ ingest + relay ---------------------------- */

export type IncomingFix = { lat: number; lng: number; heading?: number | null; speed?: number | null };

/**
 * Accept one GPS fix from a cleaner's device, then fan it out to everyone
 * entitled to watch it and (on a slower clock) to the database.
 *
 * Returns the booking ids the fix was broadcast into, which the caller uses
 * only for logging — callers must never block on this.
 */
export async function recordAgentLocation(agentId: string, fix: IncomingFix): Promise<string[]> {
  const lat = Number(fix.lat);
  const lng = Number(fix.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];

  const now = Date.now();
  const next: LngLat = [lng, lat];
  const prev = agentFixCache.get(agentId);

  // Reject teleports. Checked against the in-memory previous fix rather than
  // the stored one because persistence runs on a slower clock — comparing a
  // fresh fix to a five-second-old row would silently widen the speed gate.
  if (prev && !isPlausibleMove(prev.point, new Date(prev.at), next, now)) {
    console.warn(`[tracking] implausible fix from agent ${agentId} — ignored`);
    return [];
  }

  // Prefer the device's own heading; fall back to the direction of travel.
  // A stationary phone reports a meaningless heading, so a zero-length hop
  // keeps whatever the marker was already pointing at instead of snapping.
  const reported = Number(fix.heading);
  const heading = Number.isFinite(reported)
    ? ((reported % 360) + 360) % 360
    : prev && haversineMeters(prev.point, next) > 5
      ? bearingDegrees(prev.point, next)
      : (prev?.heading ?? null);

  const speed = Number.isFinite(Number(fix.speed)) ? Number(fix.speed) : null;

  const shouldBroadcast = !prev || now - prev.lastBroadcastAt >= BROADCAST_THROTTLE_MS;
  const shouldPersist = !prev || now - prev.lastPersistAt >= PERSIST_THROTTLE_MS;

  pruneFixCache(now);
  agentFixCache.set(agentId, {
    point: next,
    at: now,
    heading,
    lastBroadcastAt: shouldBroadcast ? now : (prev?.lastBroadcastAt ?? now),
    lastPersistAt: shouldPersist ? now : (prev?.lastPersistAt ?? now),
  });

  if (shouldPersist) {
    const point = toPoint(lat, lng);
    if (point) {
      await User.updateOne(
        { _id: agentId, role: "agent", agentStatus: "verified" },
        { liveLocation: point, locationUpdatedAt: new Date(now) },
      ).catch((err) => console.error("[tracking] persist failed:", (err as Error).message));
    }
  }

  if (!shouldBroadcast) return [];

  const bookingIds = await activeBookingIds(agentId);
  if (bookingIds.length === 0) return [];

  const live: LiveFix = { lat, lng, heading, speed, updatedAt: new Date(now).toISOString() };

  // Every watcher of a booking gets the fix through that booking's room, so a
  // customer only ever receives positions for jobs that are actually theirs.
  for (const bookingId of bookingIds) {
    emitToRoom(bookingRoom(bookingId), "agent_location_update", { bookingId, agentId, ...live });
  }
  // Admins watch the fleet, not a single job, so they get one message naming
  // every booking it applies to rather than one per room they'd have to join.
  emitToAdmins("agent_location_update", { agentId, bookingIds, ...live });

  return bookingIds;
}

/**
 * Announce a job-status change to everyone watching the booking.
 *
 * Called after the status is already persisted, so a failure here costs a live
 * refresh — never the state change itself.
 */
export function broadcastJobStatus(booking: BookingDocument): void {
  const bookingId = String(booking._id);
  const payload = {
    bookingId,
    jobStatus: booking.jobStatus,
    dispatchStatus: booking.dispatchStatus,
    status: booking.status,
    agentName: booking.agentName ?? null,
    at: new Date().toISOString(),
  };
  emitToRoom(bookingRoom(bookingId), "booking_progress", payload);
  emitToUser(customerIdOf(booking), "booking_progress", payload);
  emitToAdmins("booking_progress", payload);
}

function customerIdOf(b: BookingDocument): string {
  const u = b.user as unknown as { _id?: unknown } | Types.ObjectId | null;
  return String((u as { _id?: unknown })?._id ?? u);
}

/* ------------------------------ authorization ----------------------------- */

export type Viewer = { id: string; role: string };

/**
 * Whether this viewer may watch a booking's live position, and the booking if
 * so. Deliberately the single gate for both the REST snapshot and the socket
 * room join — a second implementation is a second place to get it wrong.
 */
export async function assertCanTrack(bookingId: string, viewer: Viewer): Promise<BookingDocument> {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Booking not found");

  const booking = await Booking.findById(bookingId).populate("user", "name phone");
  if (!booking) throw ApiError.notFound("Booking not found");

  if (viewer.role === "admin") return booking;
  if (viewer.role === "agent") {
    // Assigned only. This deliberately does NOT include the agent currently
    // holding an offer: nothing in the apps needs it (the offer popup renders
    // from the offer payload, not from tracking), and granting it let an agent
    // join a booking's room, decline the job, and then keep watching the
    // winning agent's live GPS — room membership outlives the offer that
    // justified it.
    if (booking.assignedAgent && String(booking.assignedAgent) === viewer.id) return booking;
    throw ApiError.forbidden("This job is not assigned to you");
  }
  if (customerIdOf(booking) === viewer.id) return booking;
  throw ApiError.forbidden("You cannot track this booking");
}

/* -------------------------------- snapshot -------------------------------- */

function bookingPoint(b: BookingDocument): LngLat | null {
  const coords = (b.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  return coords && coords.length === 2 ? [coords[0], coords[1]] : null;
}

/** Straight-line minutes at city speed, floored so it never reads "0 min". */
export function fallbackEtaMinutes(distanceM: number): number {
  const minutes = distanceM / 1000 / FALLBACK_SPEED_KMH * 60;
  return Math.max(MIN_ETA_MINUTES, Math.round(minutes));
}

/**
 * Freshest known position for an agent: the in-memory fix when this worker has
 * been receiving their stream, otherwise the stored one. Returns null once the
 * newest fix is old enough that showing it would be a lie.
 */
type StoredLocation = { liveLocation?: unknown; locationUpdatedAt?: Date | null } | null;

export async function agentFix(agentId: string, preloaded?: StoredLocation): Promise<LiveFix | null> {
  const cached = agentFixCache.get(agentId);
  if (cached && Date.now() - cached.at <= LOCATION_STALE_MS) {
    return {
      lat: cached.point[1],
      lng: cached.point[0],
      heading: cached.heading,
      speed: null,
      updatedAt: new Date(cached.at).toISOString(),
    };
  }

  // `preloaded` lets a caller that already has the row skip the lookup —
  // `undefined` means "not provided, go and read it", `null` means "read it,
  // there was nothing".
  const agent =
    preloaded !== undefined
      ? preloaded
      : await User.findById(agentId).select("liveLocation locationUpdatedAt").lean();
  const coords = (agent?.liveLocation as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  if (!coords || coords.length !== 2 || !agent?.locationUpdatedAt) return null;
  const at = new Date(agent.locationUpdatedAt).getTime();
  if (Date.now() - at > LOCATION_STALE_MS) return null;
  return {
    lat: coords[1],
    lng: coords[0],
    heading: cached?.heading ?? null,
    speed: null,
    updatedAt: new Date(at).toISOString(),
  };
}

export type TrackingSnapshot = Awaited<ReturnType<typeof getTrackingSnapshot>>;

/**
 * Everything a tracking screen needs to render itself from cold — the initial
 * paint, and the recovery path after a dropped socket. Live events afterwards
 * only patch what this establishes.
 */
export async function getTrackingSnapshot(bookingId: string, viewer: Viewer) {
  const b = await assertCanTrack(bookingId, viewer);

  const destination = bookingPoint(b);
  const trackable =
    b.status === "upcoming" &&
    !!b.assignedAgent &&
    (TRACKABLE_JOB_STATUSES as readonly string[]).includes(String(b.jobStatus));

  const fix = trackable && b.assignedAgent ? await agentFix(String(b.assignedAgent)) : null;

  const distanceM =
    fix && destination ? Math.round(haversineMeters([fix.lng, fix.lat], destination)) : null;

  // Once the cleaner is on site the distance is noise, and an ETA is actively
  // wrong — they have already arrived.
  const travelling = b.jobStatus === "assigned" || b.jobStatus === "enroute";

  const customer = b.user as unknown as { name?: string; phone?: string } | null;

  let agent: { id: string; name: string; phone: string | null; rating: number; jobsDone: number } | null = null;
  if (b.assignedAgent) {
    const doc = await User.findById(b.assignedAgent).select("name phone rating jobsDone").lean();
    if (doc) {
      agent = {
        id: String(doc._id),
        name: doc.name,
        // The cleaner's number is released to the customer only while a job is
        // genuinely in flight, so a past booking is not a permanent directory
        // of the people who serviced it.
        phone: viewer.role === "customer" ? (trackable ? (doc.phone ?? null) : null) : (doc.phone ?? null),
        rating: doc.rating ?? 0,
        jobsDone: doc.jobsDone ?? 0,
      };
    }
  }

  return {
    bookingId: String(b._id),
    status: b.status,
    dispatchStatus: b.dispatchStatus,
    jobStatus: b.jobStatus,
    trackable,
    packageName: b.packageName,
    vehicleName: b.vehicleName,
    vehicleType: b.vehicleType,
    price: b.price,
    date: b.date,
    slot: b.slot,
    addressLabel: b.addressLabel,
    addressLine: b.addressLine,
    society: b.society,
    createdAt: b.createdAt,
    assignedAt: b.assignedAt,
    offerExpiresAt: b.offerExpiresAt,
    dispatchAttempts: b.dispatchAttempts ?? 0,
    searchRadiusM: b.searchRadiusM ?? 0,
    destination: destination ? { lat: destination[1], lng: destination[0] } : null,
    customerName: customer?.name ?? "Customer",
    customerPhone: viewer.role === "customer" ? null : (customer?.phone ?? null),
    agent,
    agentLocation: fix,
    distanceM: travelling ? distanceM : null,
    etaMinutes: travelling && distanceM != null ? fallbackEtaMinutes(distanceM) : null,
    beforePhotos:
      b.beforePhotos && b.beforePhotos.length > 0
        ? b.beforePhotos
        : b.beforePhotoUrl
          ? [b.beforePhotoUrl]
          : [],
    afterPhotos:
      b.afterPhotos && b.afterPhotos.length > 0
        ? b.afterPhotos
        : b.afterPhotoUrl
          ? [b.afterPhotoUrl]
          : [],
    beforePhotoUrl: b.beforePhotoUrl || (b.beforePhotos?.[0] ?? null),
    afterPhotoUrl: b.afterPhotoUrl || (b.afterPhotos?.[0] ?? null),
  };
}

export type AgentLocationSnapshot = {
  agentId: string;
  name: string;
  online: boolean;
  agentLocation: LiveFix | null;
};

/**
 * One agent's current position, independent of any specific booking — backs
 * the admin's "live location" button on the agent's profile page.
 *
 * Deliberately admin-only. `assertCanTrack` above grants a customer or the
 * assigned agent a view of a *booking's* tracking feed, which is scoped to a
 * job both of them are already party to; an agent's whereabouts while they
 * are not working a customer's job is nobody else's business.
 */
export async function getAgentLocationSnapshot(agentId: string, viewer: Viewer): Promise<AgentLocationSnapshot> {
  if (viewer.role !== "admin") throw ApiError.forbidden("Admins only");
  if (!Types.ObjectId.isValid(agentId)) throw ApiError.notFound("Agent not found");

  const agent = await User.findOne({ _id: agentId, role: "agent" })
    .select("name online liveLocation locationUpdatedAt")
    .lean();
  if (!agent) throw ApiError.notFound("Agent not found");

  return {
    agentId,
    name: agent.name,
    online: agent.online ?? false,
    // Reuses the exact same freshness rule a customer's tracking screen uses
    // (in-memory fix when this worker is streaming it, else the stored one,
    // null once it's stale) — an idle agent's last-known point is only worth
    // showing while it's still plausibly where they are.
    agentLocation: await agentFix(agentId, agent),
  };
}

/**
 * Live positions of every cleaner currently mid-job, for the admin fleet map.
 * One aggregate rather than a per-booking fan-out, because the console renders
 * them all on a single canvas.
 */
export async function getFleetSnapshot() {
  const bookings = await Booking.find({
    status: "upcoming",
    assignedAgent: { $ne: null },
    jobStatus: { $in: TRACKABLE_JOB_STATUSES },
  })
    .select("assignedAgent agentName jobStatus location packageName addressLabel")
    .populate("user", "name")
    .lean();

  // One read for every cleaner on the board. This used to look each one up
  // inside the loop, so a busy Saturday turned one console refresh into a
  // query per in-flight job.
  const agentIds = [...new Set(bookings.map((b) => String(b.assignedAgent)))];
  const agentRows = await User.find({ _id: { $in: agentIds } })
    .select("liveLocation locationUpdatedAt")
    .lean();
  const byAgent = new Map(agentRows.map((row) => [String(row._id), row as StoredLocation]));

  const out = [];
  for (const b of bookings) {
    const agentId = String(b.assignedAgent);
    const fix = await agentFix(agentId, byAgent.get(agentId) ?? null);
    const coords = (b.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
    const destination = coords && coords.length === 2 ? { lat: coords[1], lng: coords[0] } : null;
    const distanceM =
      fix && coords && coords.length === 2
        ? Math.round(haversineMeters([fix.lng, fix.lat], [coords[0], coords[1]]))
        : null;
    out.push({
      bookingId: String(b._id),
      agentId,
      agentName: b.agentName ?? "Cleaner",
      customerName: (b.user as unknown as { name?: string } | null)?.name ?? "Customer",
      jobStatus: b.jobStatus,
      packageName: b.packageName,
      addressLabel: b.addressLabel,
      destination,
      agentLocation: fix,
      distanceM,
      etaMinutes:
        distanceM != null && (b.jobStatus === "assigned" || b.jobStatus === "enroute")
          ? fallbackEtaMinutes(distanceM)
          : null,
    });
  }
  return out;
}
