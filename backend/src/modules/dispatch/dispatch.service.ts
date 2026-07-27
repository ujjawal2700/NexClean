import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { agentLiveSince, isAgentLive } from "../user/presence";
import { notifyUser, pushToUser } from "../notification/notification.service";
import { emitToUser, emitToAdmins } from "../../shared/services/socket";
import { haversineMeters, type LngLat } from "../../shared/geo";
import { findNearestEligibleAgents, type NearbyAgent } from "./dispatch.query";
import {
  OFFER_TTL_MS,
  SEARCH_RADII_M,
  OFFER_BATCH,
  SWEEP_INTERVAL_MS,
  SUBSCRIPTION_LEAD_MS,
} from "./dispatch.config";

/* ----------------------------- helpers ---------------------------------- */

function bookingPoint(b: BookingDocument): LngLat | null {
  const coords = (b.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  return coords && coords.length === 2 ? [coords[0], coords[1]] : null;
}

function customerId(b: BookingDocument): string {
  const u = b.user as unknown as { _id?: unknown } | Types.ObjectId | null;
  return String((u as { _id?: unknown })?._id ?? u);
}

/** Payload the agent app renders in the incoming-offer popup. */
function buildOfferPayload(b: BookingDocument, distanceM: number | null) {
  return {
    bookingId: String(b._id),
    customerName: "Customer",
    vehicleType: b.vehicleType,
    vehicleName: b.vehicleName,
    packageName: b.packageName,
    addressLabel: b.addressLabel,
    addressLine: b.society || "",
    society: b.society,
    date: b.date,
    slot: b.slot,
    price: b.price,
    payout: Math.round(b.price * 0.7),
    distanceKm: distanceM != null ? Number((distanceM / 1000).toFixed(1)) : null,
    isSubscriptionWash: b.isSubscriptionWash,
    expiresAt: b.offerExpiresAt,
  };
}

/** Live-updates the admin dispatch console. */
export function emitDispatchUpdate() {
  emitToAdmins("dispatch_update", { at: Date.now() });
}

/**
 * Tell a specific agent their pending offer has been cancelled (booking was
 * cancelled or completed by admin before they responded).
 */
export function emitCancelToAgent(agentId: string, bookingId: string) {
  emitToUser(agentId, "offer_revoked", { bookingId });
}

async function sendOffer(b: BookingDocument, candidate: NearbyAgent) {
  const payload = buildOfferPayload(b, candidate.distanceM);
  emitToUser(candidate.id, "job_offer", payload);
  // FCM backup so a backgrounded agent app still gets pinged. Push-only (no feed row).
  await pushToUser(candidate.id, {
    title: "🚗 New wash request",
    body: `${b.packageName} · ${b.vehicleName} · ${(candidate.distanceM / 1000).toFixed(1)} km away`,
    data: { bookingId: String(b._id), kind: "offer" },
  }).catch((err) => console.error("offer push failed:", (err as Error).message));
}

async function moveToAdminQueue(b: BookingDocument) {
  b.dispatchStatus = "pending_admin";
  b.currentOfferAgent = null;
  b.offerExpiresAt = null;
  await b.save();
  emitDispatchUpdate();
  emitToAdmins("dispatch_pending", { bookingId: String(b._id) });
}

/** Notify the customer + refresh admin views once a cleaner is locked in. */
async function onAssigned(b: BookingDocument, agent: { id: string; name: string }) {
  const cid = customerId(b);
  emitToUser(cid, "booking_assigned", { bookingId: String(b._id), agentName: agent.name });
  await notifyUser(cid, {
    type: "booking",
    title: "✅ Cleaner on the way",
    body: `${agent.name} has been assigned to your ${b.packageName}.`,
    data: { bookingId: String(b._id) },
  }).catch((err) => console.error("assign notification failed:", (err as Error).message));
  emitDispatchUpdate();
}

/* ------------------------- on-demand dispatch ---------------------------- */

/** Kick off the sequential nearest-first search for a freshly created booking. */
export async function startDispatch(bookingId: string): Promise<void> {
  const b = await Booking.findById(bookingId).populate("user", "name");
  if (!b) return;
  b.dispatchStatus = "searching";
  b.searchRadiusM = SEARCH_RADII_M[0] ?? 3000;
  b.set("declinedAgents", []);
  b.dispatchAttempts = 0;
  b.currentOfferAgent = null;
  b.offerExpiresAt = null;
  await b.save();
  await offerNext(bookingId);
}

/**
 * Offer the job to the next-nearest eligible cleaner, widening the radius when
 * a ring is exhausted. Hands off to the admin queue once the widest radius has
 * no takers.
 */
export async function offerNext(bookingId: string): Promise<void> {
  const b = await Booking.findById(bookingId).populate("user", "name");
  if (!b || b.status !== "upcoming") return;
  if (b.dispatchStatus === "assigned" || b.dispatchStatus === "cancelled") return;

  const point = bookingPoint(b);

  // Don't double-offer while a live offer is still outstanding.
  if (
    b.dispatchStatus === "offered" &&
    b.currentOfferAgent &&
    b.offerExpiresAt &&
    b.offerExpiresAt.getTime() > Date.now()
  ) {
    return;
  }

  // Real declines persist on the booking; add transient skips (agents that got
  // locked by another job between query and lock) only for this pass.
  const excluded = (b.declinedAgents ?? []).map((d) => String(d));

  if (point) {
    // ── GEO PATH: Booking has coordinates → nearest-first ──────────────────
    const startIdx = Math.max(0, SEARCH_RADII_M.indexOf(b.searchRadiusM || SEARCH_RADII_M[0]));
    for (let i = startIdx; i < SEARCH_RADII_M.length; i++) {
      const radius = SEARCH_RADII_M[i];
      const candidates = await findNearestEligibleAgents(point, radius, excluded, OFFER_BATCH);
      const candidate = candidates[0];
      if (!candidate) continue; // widen to the next ring

      // Atomically lock the cleaner to this offer (guards concurrent dispatch).
      const locked = await User.updateOne(
        { _id: candidate.id, currentOfferBooking: null },
        { currentOfferBooking: b._id },
      );
      if (locked.modifiedCount === 0) {
        excluded.push(candidate.id); // taken by another job — skip and retry this ring
        i--;
        continue;
      }

      b.set("currentOfferAgent", new Types.ObjectId(candidate.id));
      b.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
      b.dispatchStatus = "offered";
      b.searchRadiusM = radius;
      b.dispatchAttempts = (b.dispatchAttempts ?? 0) + 1;
      await b.save();

      await sendOffer(b, candidate);
      emitDispatchUpdate();
      return;
    }
    // All radii exhausted → admin queue
    await moveToAdminQueue(b);
    return;
  }

  // ── NO-GEO FALLBACK: Booking has no coordinates (e.g. dev mode / no GPS) ──
  // Dispatch to the most-recently-seen online verified agent who hasn't declined.
  const liveSince = agentLiveSince();
  const excludeIds = excluded.map((id) => new Types.ObjectId(id));

  const baseQuery = {
    role: "agent",
    agentStatus: "verified",
    online: true,
    currentOfferBooking: null,
    ...(excludeIds.length ? { _id: { $nin: excludeIds } } : {}),
  };

  // Try recently-heartbeating agents first, then fall back to any online agent.
  let fallbackAgent = await User.findOne({ ...baseQuery, lastSeenAt: { $gte: liveSince } })
    .sort({ lastSeenAt: -1 })
    .select("_id name");

  if (!fallbackAgent) {
    // Second chance: agent is marked online but heartbeat is stale (e.g. dev/test).
    fallbackAgent = await User.findOne(baseQuery).sort({ lastSeenAt: -1 }).select("_id name");
  }

  if (!fallbackAgent) {
    // No live agents at all → admin queue
    await moveToAdminQueue(b);
    return;
  }

  const locked = await User.updateOne(
    { _id: fallbackAgent._id, currentOfferBooking: null },
    { currentOfferBooking: b._id },
  );
  if (locked.modifiedCount === 0) {
    // Agent got grabbed by another booking simultaneously — try again
    await offerNext(bookingId);
    return;
  }

  b.set("currentOfferAgent", new Types.ObjectId(String(fallbackAgent._id)));
  b.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
  b.dispatchStatus = "offered";
  b.dispatchAttempts = (b.dispatchAttempts ?? 0) + 1;
  await b.save();

  await sendOffer(b, {
    id: String(fallbackAgent._id),
    name: fallbackAgent.name ?? "Agent",
    distanceM: 0,
  });
  emitDispatchUpdate();
}

/** A cleaner accepts the offer. First writer wins; everyone else gets "taken". */
export async function acceptOffer(agentId: string, bookingId: string) {
  const agent = await User.findOne({ _id: agentId, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");

  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      dispatchStatus: "offered",
      currentOfferAgent: agentId,
      offerExpiresAt: { $gt: now },
    },
    {
      $set: {
        assignedAgent: agent._id,
        agentName: agent.name,
        dispatchStatus: "assigned",
        jobStatus: "assigned",
        assignedAt: now,
        currentOfferAgent: null,
        offerExpiresAt: null,
      },
    },
    { new: true },
  ).populate("user", "name");

  if (!booking) throw ApiError.badRequest("This job is no longer available");

  await User.updateOne({ _id: agentId }, { currentOfferBooking: null });
  await onAssigned(booking, { id: String(agent._id), name: agent.name });
  return booking;
}

/** A cleaner declines — record it and move to the next-nearest. */
export async function declineOffer(agentId: string, bookingId: string) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, dispatchStatus: "offered", currentOfferAgent: agentId },
    {
      $addToSet: { declinedAgents: new Types.ObjectId(agentId) as never },
      $set: { currentOfferAgent: null, offerExpiresAt: null, dispatchStatus: "searching" },
    },
    { new: true },
  );
  await User.updateOne({ _id: agentId, currentOfferBooking: bookingId }, { currentOfferBooking: null });
  if (booking) {
    emitToUser(agentId, "offer_revoked", { bookingId });
    await offerNext(bookingId);
  }
  return { ok: true };
}

/** The current live offer for an agent (used to restore the popup on reconnect). */
export async function getOfferForAgent(agentId: string) {
  const booking = await Booking.findOne({
    dispatchStatus: "offered",
    currentOfferAgent: agentId,
    offerExpiresAt: { $gt: new Date() },
  }).populate("user", "name");
  if (!booking) return null;

  const point = bookingPoint(booking);
  const agent = await User.findById(agentId).select("liveLocation");
  const aCoords = (agent?.liveLocation as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  const distanceM =
    point && aCoords && aCoords.length === 2 ? haversineMeters([aCoords[0], aCoords[1]], point) : null;
  return buildOfferPayload(booking, distanceM);
}

/* --------------------- direct assignment (admin / subs) ------------------ */

/**
 * Canonical assignment used by the admin console and the subscription
 * scheduler. Bypasses the offer flow and pins a specific cleaner.
 */
export async function assignAgentToBooking(bookingId: string, agentId: string) {
  const agent = await User.findOne({ _id: agentId, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");

  const booking = await Booking.findById(bookingId).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const previousOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;

  booking.assignedAgent = agent.id;
  booking.agentName = agent.name;
  booking.dispatchStatus = "assigned";
  if (booking.jobStatus === "completed") booking.jobStatus = "assigned";
  booking.assignedAt = new Date();
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  await booking.save();

  // Release any offer locks tied to this booking.
  if (previousOfferAgent) {
    await User.updateOne({ _id: previousOfferAgent, currentOfferBooking: booking._id }, { currentOfferBooking: null });
    if (previousOfferAgent !== String(agent._id)) {
      emitToUser(previousOfferAgent, "offer_revoked", { bookingId: String(booking._id) });
    }
  }
  await User.updateOne({ _id: agent._id, currentOfferBooking: booking._id }, { currentOfferBooking: null });

  // Tell the assigned cleaner.
  emitToUser(String(agent._id), "job_assigned", { bookingId: String(booking._id) });
  await pushToUser(String(agent._id), {
    title: "🧽 New job assigned",
    body: `${booking.packageName} · ${booking.slot}`,
    data: { bookingId: String(booking._id) },
  }).catch((err) => console.error("assign push failed:", (err as Error).message));

  await onAssigned(booking, { id: String(agent._id), name: agent.name });
  return booking;
}

/** Assign the single nearest eligible cleaner right now (admin "auto-assign"). */
export async function autoAssignNearest(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound("Booking not found");
  const point = bookingPoint(booking);
  if (!point) throw ApiError.badRequest("This booking has no saved location to rank cleaners by");
  const [candidate] = await findNearestEligibleAgents(point, SEARCH_RADII_M[SEARCH_RADII_M.length - 1], [], 1);
  if (!candidate) throw ApiError.badRequest("No available cleaners nearby to auto-assign");
  return assignAgentToBooking(bookingId, candidate.id);
}

/**
 * Bulk re-dispatch: find every booking that is stuck in the queue
 * (searching / offered / pending_admin) and re-trigger the dispatch pipeline
 * for each one. Returns a count of how many were kicked off.
 */
export async function autoAssignAll(): Promise<{ kicked: number; skipped: number }> {
  const bookings = await Booking.find({
    status: "upcoming",
    dispatchStatus: { $in: ["searching", "offered", "pending_admin"] },
    assignedAgent: null,
  }).limit(50);

  let kicked = 0;
  let skipped = 0;

  for (const b of bookings) {
    try {
      // Re-run the full offer pipeline (nearest first, then stale-heartbeat fallback).
      await offerNext(String(b._id));
      kicked++;
    } catch {
      skipped++;
    }
  }

  emitDispatchUpdate();
  return { kicked, skipped };
}

/** Nearby cleaners for the admin picker, ranked by distance when coords exist. */
export async function listAssignableAgents(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound("Booking not found");
  const point = bookingPoint(booking);
  const liveSince = agentLiveSince().getTime();

  if (point) {
    const agents = await User.aggregate<{
      _id: Types.ObjectId;
      name: string;
      distanceM: number;
      online: boolean;
      lastSeenAt: Date | null;
      area: string;
    }>([
      {
        $geoNear: {
          near: { type: "Point", coordinates: point },
          distanceField: "distanceM",
          spherical: true,
          query: { role: "agent", agentStatus: "verified" },
        },
      },
      { $limit: 50 },
      { $project: { name: 1, distanceM: 1, online: 1, lastSeenAt: 1, area: 1 } },
    ]);
    return agents.map((a) => ({
      id: String(a._id),
      name: a.name,
      area: a.area ?? "",
      distanceKm: Number((a.distanceM / 1000).toFixed(1)),
      online: !!a.online && !!a.lastSeenAt && new Date(a.lastSeenAt).getTime() >= liveSince,
    }));
  }

  const agents = await User.find({ role: "agent", agentStatus: "verified" }).limit(50);
  return agents.map((a) => ({
    id: String(a.id),
    name: a.name,
    area: a.area ?? "",
    distanceKm: null,
    online: isAgentLive(a),
  }));
}

/* ------------------------------ admin queue ------------------------------ */

function mapQueueBooking(b: BookingDocument) {
  const user = b.user as unknown as { name?: string } | null;
  const offerAgent = b.currentOfferAgent as unknown as { name?: string } | null;

  // Surface in-progress job status as a distinct dispatchStatus so the
  // frontend can render the correct badge without a separate field.
  const effectiveDispatch =
    b.dispatchStatus === "assigned" && b.jobStatus === "in_progress"
      ? "in_progress"
      : b.dispatchStatus;

  return {
    id: String(b._id),
    customerName: (user && typeof user === "object" && user.name) || "Customer",
    vehicleName: b.vehicleName,
    packageName: b.packageName,
    date: b.date,
    slot: b.slot,
    society: b.society,
    addressLine: b.addressLine,
    price: b.price,
    dispatchStatus: effectiveDispatch as typeof b.dispatchStatus,
    agentName: b.agentName ?? null,
    isSubscriptionWash: b.isSubscriptionWash,
    hasLocation: !!bookingPoint(b),
    dispatchAttempts: b.dispatchAttempts ?? 0,
    offerExpiresAt: b.offerExpiresAt,
    currentOfferAgentName: (offerAgent && typeof offerAgent === "object" && offerAgent.name) || null,
  };
}

/**
 * Live dispatch view for the admin console.
 * Shows all active bookings: those still finding a cleaner + those already
 * assigned and in-flight. Excludes cancelled and completed bookings.
 */
export async function listAdminQueue() {
  const bookings = await Booking.find({
    // Exclude terminal states.
    status: { $in: ["upcoming"] },
    dispatchStatus: { $nin: ["cancelled"] },
  })
    .populate("user", "name")
    .populate("currentOfferAgent", "name")
    .sort({ dispatchStatus: 1, createdAt: -1 })
    .limit(200);
  return bookings.map(mapQueueBooking);
}

/* -------------------------- subscription scheduler ----------------------- */

/**
 * Auto-assign the nearest available cleaner to subscription washes whose slot
 * is within the lead window. No accept step — this matches the chosen model.
 */
export async function runSubscriptionScheduler(): Promise<void> {
  const now = Date.now();
  const due = await Booking.find({
    isSubscriptionWash: true,
    status: "upcoming",
    dispatchStatus: "scheduled",
    assignedAgent: null,
    date: { $lte: new Date(now + SUBSCRIPTION_LEAD_MS) },
  })
    .populate("user", "name")
    .limit(50);

  for (const b of due) {
    const point = bookingPoint(b);
    if (!point) {
      await moveToAdminQueue(b);
      continue;
    }
    const [candidate] = await findNearestEligibleAgents(point, SEARCH_RADII_M[SEARCH_RADII_M.length - 1], [], 1);
    if (candidate) {
      await assignAgentToBooking(String(b._id), candidate.id);
    } else if (b.date.getTime() <= now) {
      // Slot has arrived and still nobody available → let an admin place it.
      await moveToAdminQueue(b);
    }
    // Otherwise leave it "scheduled" and retry on the next tick.
  }
}

/* ------------------------------ worker loop ------------------------------ */

/** Time out stale offers and advance them to the next cleaner. */
export async function sweepOffers(): Promise<void> {
  const now = new Date();
  const expired = await Booking.find({
    dispatchStatus: "offered",
    offerExpiresAt: { $lt: now },
  }).select("_id currentOfferAgent");

  for (const b of expired) {
    const agentId = b.currentOfferAgent ? String(b.currentOfferAgent) : null;
    await Booking.updateOne(
      { _id: b._id, dispatchStatus: "offered" },
      {
        ...(agentId ? { $addToSet: { declinedAgents: new Types.ObjectId(agentId) as never } } : {}),
        $set: { currentOfferAgent: null, offerExpiresAt: null, dispatchStatus: "searching" },
      },
    );
    if (agentId) {
      await User.updateOne({ _id: agentId, currentOfferBooking: b._id }, { currentOfferBooking: null });
      emitToUser(agentId, "offer_revoked", { bookingId: String(b._id) });
    }
    await offerNext(String(b._id));
  }
}

import { sweepAndRescheduleMissedSlots } from "./slotScheduler.service";

let workerHandle: NodeJS.Timeout | null = null;
let lastSubscriptionRun = 0;
const SUBSCRIPTION_TICK_MS = 30_000;

export function startDispatchWorker() {
  if (workerHandle) return;
  workerHandle = setInterval(() => {
    void (async () => {
      try {
        await sweepOffers();
        await sweepAndRescheduleMissedSlots().catch((err) =>
          console.error("missed slot sweep failed:", (err as Error).message),
        );
        if (Date.now() - lastSubscriptionRun >= SUBSCRIPTION_TICK_MS) {
          lastSubscriptionRun = Date.now();
          await runSubscriptionScheduler();
        }
      } catch (err) {
        console.error("dispatch worker tick failed:", (err as Error).message);
      }
    })();
  }, SWEEP_INTERVAL_MS);
  if (typeof workerHandle.unref === "function") workerHandle.unref();
  console.log(`🛰️  Dispatch worker started (sweep ${SWEEP_INTERVAL_MS}ms)`);
}

export function stopDispatchWorker() {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

/**
 * Startup recovery (single-instance): release stale offer locks, reset
 * in-flight offers, and re-drive any bookings still searching.
 */
export async function resumeDispatch(): Promise<void> {
  await User.updateMany({ role: "agent", currentOfferBooking: { $ne: null } }, { currentOfferBooking: null });
  await Booking.updateMany(
    { dispatchStatus: "offered" },
    { $set: { dispatchStatus: "searching", currentOfferAgent: null, offerExpiresAt: null } },
  );

  // Auto-reschedule any past missed slots on startup
  await sweepAndRescheduleMissedSlots().catch((err) =>
    console.error("startup missed slot sweep failed:", (err as Error).message),
  );

  const pending = await Booking.find({
    dispatchStatus: "searching",
    status: "upcoming",
    assignedAgent: null,
  }).select("_id");
  for (const b of pending) {
    await offerNext(String(b._id)).catch((err) => console.error("resume offer failed:", (err as Error).message));
  }
  if (pending.length) console.log(`🛰️  Resumed dispatch for ${pending.length} booking(s)`);
}
