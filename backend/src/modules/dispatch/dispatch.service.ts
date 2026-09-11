import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { agentLiveSince, isAgentLive } from "../user/presence";
import { notifyUser, pushToUser } from "../notification/notification.service";
import { emitToUser, emitToAdmins, emitToRoom } from "../../shared/services/socket";
import { haversineMeters, type LngLat } from "../../shared/geo";
import { buildDispatchTiers, findAcrossTiers, findNearestEligibleAgents, type NearbyAgent } from "./dispatch.query";
import { payoutCalculator } from "../payout/payoutConfig.service";
import {
  broadcastJobStatus,
  forgetAgentBookings,
  bookingRoom,
  revokeAgentTracking,
} from "../tracking/tracking.service";
import {
  OFFER_TTL_MS,
  OFFER_BATCH,
  SWEEP_INTERVAL_MS,
  SUBSCRIPTION_LEAD_MS,
  REMINDER_TICK_MS,
} from "./dispatch.config";
import { runBookingReminders } from "../booking/reminder.service";

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
async function buildOfferPayload(b: BookingDocument, distanceM: number | null) {
  const payoutOf = await payoutCalculator();
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
    payout: payoutOf(b.price),
    distanceKm: distanceM != null ? Number((distanceM / 1000).toFixed(1)) : null,
    isSubscriptionWash: b.isSubscriptionWash,
    expiresAt: b.offerExpiresAt,
  };
}

/**
 * Push search progress to the waiting customer (and anyone watching the
 * booking). Without this the customer's screen is a spinner that never says
 * anything, which is exactly the moment they cancel.
 */
function emitSearchProgress(b: BookingDocument) {
  const payload = {
    bookingId: String(b._id),
    dispatchStatus: b.dispatchStatus,
    dispatchAttempts: b.dispatchAttempts ?? 0,
    searchRadiusM: b.searchRadiusM ?? 0,
    at: new Date().toISOString(),
  };
  emitToUser(customerId(b), "dispatch_progress", payload);
  emitToRoom(bookingRoom(String(b._id)), "dispatch_progress", payload);
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
  const payload = await buildOfferPayload(b, candidate.distanceM);
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
  emitSearchProgress(b);
  emitDispatchUpdate();
  emitToAdmins("dispatch_pending", { bookingId: String(b._id) });
}

/** Notify the customer + refresh admin views once a cleaner is locked in. */
async function onAssigned(b: BookingDocument, agent: { id: string; name: string }) {
  const cid = customerId(b);
  // The job just entered the trackable window: invalidate the cached
  // agent→bookings set so the very next GPS fix reaches this booking's room,
  // and push the opening state to whoever is already watching.
  forgetAgentBookings(agent.id);
  broadcastJobStatus(b);
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
  b.dispatchTierIndex = 0;
  b.searchRadiusM = 0;
  b.set("declinedAgents", []);
  b.dispatchAttempts = 0;
  b.currentOfferAgent = null;
  b.offerExpiresAt = null;
  await b.save();
  emitSearchProgress(b);
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
    // ── GEO PATH: Booking has coordinates → nearest zone to farthest ───────
    // Tiers are rebuilt fresh each call (zones rarely change and the search is
    // resumed by index, not by re-deriving where we left off) — the zone
    // containing the booking is always tier 0 at distance 0, then outward by
    // distance, with an unrestricted flat-radius tier last as a catch-all.
    const tiers = await buildDispatchTiers(point);
    const startIdx = Math.min(Math.max(0, b.dispatchTierIndex ?? 0), tiers.length - 1);
    for (let i = startIdx; i < tiers.length; i++) {
      const tier = tiers[i];
      const candidates = await findNearestEligibleAgents(point, tier.filterRadiusM, excluded, OFFER_BATCH, tier.ring);
      const candidate = candidates[0];
      if (!candidate) continue; // widen to the next tier

      // Atomically lock the cleaner to this offer (guards concurrent dispatch).
      const locked = await User.updateOne(
        { _id: candidate.id, currentOfferBooking: null },
        { currentOfferBooking: b._id },
      );
      if (locked.modifiedCount === 0) {
        excluded.push(candidate.id); // taken by another job — skip and retry this tier
        i--;
        continue;
      }

      b.set("currentOfferAgent", new Types.ObjectId(candidate.id));
      b.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
      b.dispatchStatus = "offered";
      b.dispatchTierIndex = i;
      b.searchRadiusM = tier.displayRadiusM;
      b.dispatchAttempts = (b.dispatchAttempts ?? 0) + 1;
      await b.save();

      await sendOffer(b, candidate);
      emitSearchProgress(b);
      emitDispatchUpdate();
      return;
    }
    // All tiers exhausted → admin queue
    await moveToAdminQueue(b);
    return;
  }

  // ── NO-GEO: booking has no coordinates → straight to the admin queue ──
  // There is no meaningful "nearest" cleaner without a service location, and
  // this used to hand the job to whichever verified agent had simply been seen
  // most recently — possibly in another city — burning an offer TTL per agent
  // before the job reached an admin anyway. Geocoding failing (missing or
  // over-quota Maps key, manually typed address) is exactly when a human
  // should place the job, which is the behaviour documented in
  // frontend/.env.example.
  await moveToAdminQueue(b);
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
    revokeAgentTracking(agentId, bookingId);
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
  // Captured before the overwrite: a reassignment has to revoke the previous
  // cleaner's live feed, or they keep watching their replacement drive in.
  const previousAssignedAgent = booking.assignedAgent ? String(booking.assignedAgent) : null;

  booking.assignedAgent = agent.id;
  booking.agentName = agent.name;
  booking.dispatchStatus = "assigned";
  if (booking.jobStatus === "completed") booking.jobStatus = "assigned";
  booking.assignedAt = new Date();
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  await booking.save();

  if (previousAssignedAgent && previousAssignedAgent !== String(agent._id)) {
    revokeAgentTracking(previousAssignedAgent, String(booking._id));
    forgetAgentBookings(previousAssignedAgent);
  }

  // Release any offer locks tied to this booking.
  if (previousOfferAgent) {
    await User.updateOne({ _id: previousOfferAgent, currentOfferBooking: booking._id }, { currentOfferBooking: null });
    if (previousOfferAgent !== String(agent._id)) {
      revokeAgentTracking(previousOfferAgent, String(booking._id));
      emitToUser(previousOfferAgent, "offer_revoked", { bookingId: String(booking._id) });
    }
  }
  await User.updateOne({ _id: agent._id, currentOfferBooking: booking._id }, { currentOfferBooking: null });

  // Tell the assigned cleaner.
  emitToUser(String(agent._id), "job_assigned", { bookingId: String(booking._id) });
  // notifyUser rather than pushToUser: an offer is ephemeral and rightly stays
  // out of the feed, but an assignment is work the cleaner is now accountable
  // for. It has to survive a missed push and be readable later, which is
  // exactly what a stored notification is for.
  await notifyUser(String(agent._id), {
    type: "booking",
    title: "🧽 New job assigned",
    body: `${booking.packageName} · ${booking.vehicleName} · ${booking.slot}`,
    data: { bookingId: String(booking._id), role: "agent" },
  }).catch((err) => console.error("assign notification failed:", (err as Error).message));

  await onAssigned(booking, { id: String(agent._id), name: agent.name });
  return booking;
}

/** Assign the single nearest eligible cleaner right now (admin "auto-assign"). */
export async function autoAssignNearest(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound("Booking not found");
  const point = bookingPoint(booking);
  if (!point) throw ApiError.badRequest("This booking has no saved location to rank cleaners by");
  const tiers = await buildDispatchTiers(point);
  const found = await findAcrossTiers(point, tiers, 0, [], 1);
  if (!found) throw ApiError.badRequest("No available cleaners nearby to auto-assign");
  return assignAgentToBooking(bookingId, found.candidates[0].id);
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
    const tiers = await buildDispatchTiers(point);
    const found = await findAcrossTiers(point, tiers, 0, [], 1);
    if (found) {
      await assignAgentToBooking(String(b._id), found.candidates[0].id);
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
      revokeAgentTracking(agentId, String(b._id));
      emitToUser(agentId, "offer_revoked", { bookingId: String(b._id) });
    }
    await offerNext(String(b._id));
  }
}

import { sweepAndRescheduleMissedSlots } from "./slotScheduler.service";

let workerHandle: NodeJS.Timeout | null = null;
let lastSubscriptionRun = 0;
let lastReminderRun = 0;
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
        if (Date.now() - lastReminderRun >= REMINDER_TICK_MS) {
          lastReminderRun = Date.now();
          await runBookingReminders().catch((err) =>
            console.error("booking reminder sweep failed:", (err as Error).message),
          );
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
