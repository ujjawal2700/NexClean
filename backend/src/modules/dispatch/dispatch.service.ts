import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { isAgentLive } from "../user/presence";
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
  OFFER_BATCH,
  SWEEP_INTERVAL_MS,
  SUBSCRIPTION_LEAD_MS,
  REMINDER_TICK_MS,
  MAX_MISSED_OFFERS,
} from "./dispatch.config";
import { getOfferTtlMs } from "./dispatchConfig.service";
import { runBookingReminders } from "../booking/reminder.service";
import { logBookingEvent, adminName } from "../booking/bookingEvent.service";

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
  const user = b.user as unknown as { name?: string } | null;
  return {
    bookingId: String(b._id),
    customerName: user?.name || "Customer",
    vehicleType: b.vehicleType,
    vehicleName: b.vehicleName,
    packageName: b.packageName,
    addressLabel: b.addressLabel,
    addressLine: b.society || "",
    society: b.society,
    date: b.date,
    slot: b.slot,
    price: b.price,
    payout: payoutOf(b.price, b.isSubscriptionWash),
    distanceKm: distanceM != null ? Number((distanceM / 1000).toFixed(1)) : null,
    isSubscriptionWash: b.isSubscriptionWash,
    expiresAt: b.offerExpiresAt,
  };
}

/** Compact, human-readable copy for an expanded OS job-offer notification. */
function buildOfferPush(payload: Awaited<ReturnType<typeof buildOfferPayload>>) {
  const address = [payload.addressLabel, payload.addressLine].filter(Boolean).join(" — ");

  return {
    title: "🚗 New wash request",
    body: [
      `Customer: ${payload.customerName}`,
      `Location: ${address}`,
      `Wash type: ${payload.packageName}`,
    ]
      .filter(Boolean)
      .join("\n"),
    // Attach offer details without financial amounts. Tapping restores the
    // authoritative live offer from the server before accepting.
    data: {
      bookingId: payload.bookingId,
      kind: "offer",
      role: "agent",
      url: "/agent",
      customerName: payload.customerName,
      vehicleType: payload.vehicleType,
      vehicleName: payload.vehicleName,
      packageName: payload.packageName,
      addressLabel: payload.addressLabel,
      addressLine: payload.addressLine,
      society: payload.society,
      date: new Date(payload.date).toISOString(),
      slot: payload.slot,
      distanceKm: payload.distanceKm == null ? "" : String(payload.distanceKm),
      isSubscriptionWash: String(payload.isSubscriptionWash),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : "",
    },
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
  // The push is what reaches an online cleaner whose app is closed or swiped
  // away. Push-only (no feed row). It lives only as long as the offer: a "new
  // job" arriving after it has gone to someone else is worse than none.
  const ttlSeconds = b.offerExpiresAt
    ? Math.max(1, Math.round((b.offerExpiresAt.getTime() - Date.now()) / 1000))
    : undefined;
  const push = buildOfferPush(payload);
  void pushToUser(candidate.id, {
    ...push,
    jobOffer: true,
    ttlSeconds,
  }).catch((err) => console.error("offer push failed:", (err as Error).message));
}

/**
 * An offer ran out on a cleaner without an answer. Online lasts until the
 * cleaner switches it off — even with the app closed — so a run of these is
 * the only sign their phone is off or unreachable. At the limit they're set
 * offline and told why, instead of stalling every nearby booking for a full
 * offer timeout each.
 */
async function recordMissedOffer(agentId: string): Promise<void> {
  if (MAX_MISSED_OFFERS <= 0) return;
  const agent = await User.findOneAndUpdate({ _id: agentId }, { $inc: { missedOffers: 1 } }, { new: true }).select(
    "missedOffers online",
  );
  if (!agent?.online || (agent.missedOffers ?? 0) < MAX_MISSED_OFFERS) return;

  const off = await User.updateOne({ _id: agentId, online: true }, { online: false, missedOffers: 0 });
  if (off.modifiedCount === 0) return;
  emitToUser(agentId, "auto_offline", { missedOffers: MAX_MISSED_OFFERS });
  emitDispatchUpdate();
  void notifyUser(agentId, {
    type: "system",
    title: "You're now offline",
    body: `You missed ${MAX_MISSED_OFFERS} job offers in a row, so we've set you offline. Go online again when you're ready for jobs.`,
    data: { role: "agent", url: "/agent", kind: "auto_offline" },
  }).catch((err) => console.error("auto-offline notification failed:", (err as Error).message));
}

async function moveToAdminQueue(b: BookingDocument) {
  if (b.dispatchStatus === "pending_admin") return;
  // Do not let a concurrent no-candidate search overwrite an offer another
  // caller has just claimed. This is the same booking-side compare-and-swap
  // used when publishing an offer below.
  const moved = await Booking.findOneAndUpdate(
    {
      _id: b._id,
      status: "upcoming",
      dispatchStatus: b.dispatchStatus,
      currentOfferAgent: b.currentOfferAgent ?? null,
      offerExpiresAt: b.offerExpiresAt ?? null,
    },
    {
      $set: {
        dispatchStatus: "pending_admin",
        currentOfferAgent: null,
        offerExpiresAt: null,
      },
    },
    { new: true },
  ).populate("user", "name");
  if (!moved) return;
  logBookingEvent(moved._id, {
    type: "admin_queue",
    reason: bookingPoint(moved) ? "No cleaner accepted within the search area" : "Booking has no map location",
  });
  emitSearchProgress(moved);
  emitDispatchUpdate();
  emitToAdmins("dispatch_pending", { bookingId: String(moved._id) });
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
  // Booking creation already initializes dispatch fields. A delayed/repeated
  // kickoff must never save an old snapshot over a live offer or assignment.
  if (!b || b.status !== "upcoming" || b.assignedAgent || b.dispatchStatus !== "searching") return;
  logBookingEvent(b._id, { type: "searching" });
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
  if (b.assignedAgent || b.dispatchStatus === "assigned" || b.dispatchStatus === "cancelled") return;

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

      // Resolve configuration before locking: a failed config read must not
      // leave an agent reserved without a published offer.
      const expiresAt = new Date(Date.now() + (await getOfferTtlMs()));
      const leaseUntil = new Date(expiresAt.getTime() + 30_000);
      // Atomically lock the cleaner to this offer (guards concurrent dispatch).
      const locked = await User.updateOne(
        { _id: candidate.id, currentOfferBooking: null, role: "agent", agentStatus: "verified", status: { $ne: "suspended" }, online: true },
        { currentOfferBooking: b._id, currentOfferLeaseUntil: leaseUntil },
      );
      if (locked.modifiedCount === 0) {
        excluded.push(candidate.id); // taken by another job — skip and retry this tier
        i--;
        continue;
      }

      // Claim the booking as well as the agent. Two HTTP/worker paths can both
      // enter offerNext (timeout + decline, reconnect recovery, etc.). The
      // agent lock alone is insufficient: each path could lock a different
      // agent and the later save would overwrite the first offer, leaving a
      // popup on an agent who can no longer accept it.
      // On ambiguous DB failure, retain the lease: reconciliation checks the
      // booking before releasing it, since the write may have committed.
      const claimed = await Booking.findOneAndUpdate(
        {
          _id: b._id,
          status: "upcoming",
          assignedAgent: null,
          dispatchStatus: b.dispatchStatus,
          currentOfferAgent: b.currentOfferAgent ?? null,
          offerExpiresAt: b.offerExpiresAt ?? null,
        },
        {
          $set: {
            currentOfferAgent: new Types.ObjectId(candidate.id),
            offerExpiresAt: expiresAt,
            dispatchStatus: "offered",
            dispatchTierIndex: i,
            searchRadiusM: tier.displayRadiusM,
          },
          $inc: { dispatchAttempts: 1 },
        },
        { new: true },
      ).populate("user", "name");

      if (!claimed) {
        await User.updateOne(
          { _id: candidate.id, currentOfferBooking: b._id, currentOfferLeaseUntil: leaseUntil },
          { currentOfferBooking: null, currentOfferLeaseUntil: null },
        );
        return;
      }

      logBookingEvent(claimed._id, {
        type: "offered",
        agentId: candidate.id,
        agentName: candidate.name,
        meta: { distanceM: Math.round(candidate.distanceM), expiresAt: expiresAt.toISOString() },
      });
      await sendOffer(claimed, candidate);
      emitSearchProgress(claimed);
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
      status: "upcoming",
      dispatchStatus: "offered",
      currentOfferAgent: agentId,
      offerExpiresAt: { $gt: now },
    },
    {
      $set: {
        assignedAgent: agent._id,
        rescheduleConfirmationToken: null,
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

  if (!booking) {
    await releaseDeadOfferLock(agentId);
    throw ApiError.badRequest("This job is no longer available");
  }

  await User.updateOne({ _id: agentId, currentOfferBooking: bookingId }, { currentOfferBooking: null, currentOfferLeaseUntil: null, missedOffers: 0 });
  logBookingEvent(booking._id, { type: "accepted", agentId, agentName: agent.name, actor: "agent", actorName: agent.name });
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
  await User.updateOne({ _id: agentId, currentOfferBooking: bookingId }, { currentOfferBooking: null, currentOfferLeaseUntil: null });
  // A decline is an answer: the phone is reachable.
  await User.updateOne({ _id: agentId }, { missedOffers: 0 });
  if (booking) {
    logBookingEvent(booking._id, { type: "declined", agentId, actor: "agent" });
    revokeAgentTracking(agentId, bookingId);
    emitToUser(agentId, "offer_revoked", { bookingId });
    await offerNext(bookingId);
  }
  return { ok: true };
}

/**
 * A cleaner gives back a job they were assigned — an emergency, a car that
 * won't start — before they've started cleaning. Until now an accepted job
 * could only be dropped by phoning an admin.
 *
 * The job goes straight back out: on-demand bookings to the next-nearest
 * cleaner (never the one who gave it back), subscription washes to the
 * scheduler, which assigns someone ahead of the slot. The customer is told,
 * and the reason is kept on the booking for admins.
 */
export async function releaseJob(agentId: string, bookingId: string, reason: string, rescheduleToken?: string) {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Job not found");
  const agent = await User.findById(agentId).select("name");
  const current = await Booking.findOne({ _id: bookingId, assignedAgent: agentId }).select("status jobStatus");
  if (!current) throw ApiError.notFound("Job not found");
  if (current.status === "cancelled") throw ApiError.badRequest("This booking was already cancelled.");
  if (current.status === "completed" || current.jobStatus === "completed") {
    throw ApiError.badRequest("This job is already completed.");
  }
  if (current.jobStatus === "in_progress") {
    throw ApiError.badRequest("You've already started cleaning, so you can't give this job back. Contact support.");
  }

  // Conditional on still being ours and not started, so it can't race a
  // reassignment or the cleaner tapping "Start cleaning" at the same moment.
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      assignedAgent: agentId,
      status: "upcoming",
      jobStatus: { $in: ["assigned", "enroute", "arrived"] },
      ...(rescheduleToken ? { rescheduleConfirmationToken: rescheduleToken } : {}),
    },
    [
      {
        $set: {
          assignedAgent: null,
          rescheduleConfirmationToken: null,
          agentName: null,
          assignedAt: null,
          jobStatus: "assigned",
          currentOfferAgent: null,
          offerExpiresAt: null,
          dispatchStatus: { $cond: ["$isSubscriptionWash", "scheduled", "searching"] },
          declinedAgents: { $setUnion: [{ $ifNull: ["$declinedAgents", []] }, [new Types.ObjectId(agentId)]] },
          agentReleases: {
            $concatArrays: [
              { $ifNull: ["$agentReleases", []] },
              [{ agent: new Types.ObjectId(agentId), agentName: agent?.name ?? "", reason, at: "$$NOW" }],
            ],
          },
        },
      },
    ],
    { new: true },
  ).populate("user", "name");
  if (!booking) throw ApiError.conflict("This job changed just now — refresh and try again.");
  logBookingEvent(booking._id, {
    type: "released",
    agentId,
    agentName: agent?.name ?? "",
    actor: "agent",
    actorName: agent?.name ?? "",
    reason,
    meta: { jobStatus: current.jobStatus },
  });

  revokeAgentTracking(agentId, bookingId);
  forgetAgentBookings(agentId);
  broadcastJobStatus(booking);
  emitDispatchUpdate();

  const customerId = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
  void notifyUser(customerId, {
    type: "booking",
    title: "🔄 Finding you another cleaner",
    body: booking.isSubscriptionWash
      ? `Your cleaner for ${booking.packageName} (${booking.slot}) can't make it. We'll assign another before your slot.`
      : `Your cleaner for ${booking.packageName} (${booking.slot}) can't make it. We're finding you another one now.`,
    data: { bookingId, url: `/app/track/${bookingId}` },
  }).catch((err) => console.error("release notification failed:", (err as Error).message));

  if (!booking.isSubscriptionWash) {
    void offerNext(bookingId).catch((err) =>
      console.error("re-dispatch after release failed:", (err as Error).message),
    );
  }
  return { ok: true };
}

/** Release abandoned reservations without interfering with an in-flight claim. */
async function releaseDeadOfferLock(agentId: string): Promise<void> {
  const agent = await User.findById(agentId).select("currentOfferBooking currentOfferLeaseUntil");
  const held = agent?.currentOfferBooking;
  if (!held) return;
  const now = new Date();
  // Stamp legacy locks once during rollout. Heartbeats update updatedAt,
  // so using that field for expiry would keep abandoned locks alive forever.
  if (!agent.currentOfferLeaseUntil) {
    await User.updateOne({ _id: agentId, currentOfferBooking: held, currentOfferLeaseUntil: null },
      { currentOfferLeaseUntil: new Date(now.getTime() + 90_000) });
    return;
  }
  if (agent.currentOfferLeaseUntil > now) return;
  const live = await Booking.exists({
    _id: held, status: "upcoming", dispatchStatus: "offered",
    currentOfferAgent: agentId, offerExpiresAt: { $gt: now },
  });
  if (live) return;
  await User.updateOne({
    _id: agentId, currentOfferBooking: held,
    currentOfferLeaseUntil: agent.currentOfferLeaseUntil ?? null,
  }, { currentOfferBooking: null, currentOfferLeaseUntil: null });
}

export async function getOfferForAgent(agentId: string) {
  const booking = await Booking.findOne({
    status: "upcoming",
    dispatchStatus: "offered",
    currentOfferAgent: agentId,
    offerExpiresAt: { $gt: new Date() },
  }).populate("user", "name");
  if (!booking) {
    await releaseDeadOfferLock(agentId);
    return null;
  }

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
/**
 * How an assignment came about, for the booking timeline: an admin picking a
 * cleaner, an admin's one-tap auto-assign, or the subscription scheduler.
 */
export type AssignSource = { source: "admin" | "auto" | "scheduler"; adminId?: string | null };

export async function assignAgentToBooking(
  bookingId: string,
  agentId: string,
  how: AssignSource = { source: "admin" },
) {
  const agent = await User.findOne({ _id: agentId, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");
  if (!isAgentLive(agent)) {
    throw ApiError.conflict("This cleaner is offline. Choose an online cleaner.");
  }

  const booking = await Booking.findById(bookingId).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const heldOffer = agent.currentOfferBooking ? String(agent.currentOfferBooking) : null;
  if (heldOffer && heldOffer !== bookingId) {
    throw ApiError.conflict("This cleaner is currently reviewing another job.");
  }
  const busyElsewhere = await Booking.exists({
    _id: { $ne: booking._id },
    assignedAgent: agent._id,
    status: "upcoming",
    jobStatus: { $in: ["assigned", "enroute", "arrived", "in_progress"] },
  });
  if (busyElsewhere) throw ApiError.conflict("This cleaner is already working on another job.");

  const previousOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;
  // Captured before the overwrite: a reassignment has to revoke the previous
  // cleaner's live feed, or they keep watching their replacement drive in.
  const previousAssignedAgent = booking.assignedAgent ? String(booking.assignedAgent) : null;

  booking.assignedAgent = agent.id;
  booking.rescheduleConfirmationToken = null;
  booking.agentName = agent.name;
  booking.dispatchStatus = "assigned";
  if (booking.jobStatus === "completed") booking.jobStatus = "assigned";
  booking.assignedAt = new Date();
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  await booking.save();
  logBookingEvent(booking._id, {
    type: how.source === "admin" ? "assigned" : "auto_assigned",
    agentId: agent._id,
    agentName: agent.name,
    actor: how.source === "scheduler" ? "system" : "admin",
    actorName: how.source === "scheduler" ? "" : await adminName(how.adminId),
    meta:
      previousAssignedAgent && previousAssignedAgent !== String(agent._id)
        ? { replacedAgentId: previousAssignedAgent }
        : undefined,
  });

  if (previousAssignedAgent && previousAssignedAgent !== String(agent._id)) {
    revokeAgentTracking(previousAssignedAgent, String(booking._id));
    forgetAgentBookings(previousAssignedAgent);
  }

  // Release any offer locks tied to this booking.
  if (previousOfferAgent) {
    await User.updateOne({ _id: previousOfferAgent, currentOfferBooking: booking._id }, { currentOfferBooking: null, currentOfferLeaseUntil: null });
    if (previousOfferAgent !== String(agent._id)) {
      revokeAgentTracking(previousOfferAgent, String(booking._id));
      emitToUser(previousOfferAgent, "offer_revoked", { bookingId: String(booking._id) });
    }
  }
  await User.updateOne({ _id: agent._id, currentOfferBooking: booking._id }, { currentOfferBooking: null, currentOfferLeaseUntil: null });

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
export async function autoAssignNearest(bookingId: string, adminId?: string | null) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound("Booking not found");
  const point = bookingPoint(booking);
  if (!point) throw ApiError.badRequest("This booking has no saved location to rank cleaners by");
  const tiers = await buildDispatchTiers(point);
  const found = await findAcrossTiers(point, tiers, 0, [], 1);
  if (!found) throw ApiError.badRequest("No available cleaners nearby to auto-assign");
  return assignAgentToBooking(bookingId, found.candidates[0].id, { source: "auto", adminId });
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

/** Online, available cleaners for manual assignment; GPS only affects ordering. */
export async function listAssignableAgents(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound("Booking not found");
  const point = bookingPoint(booking);
  const busy = await Booking.find({
    _id: { $ne: booking._id },
    status: "upcoming",
    jobStatus: { $in: ["assigned", "enroute", "arrived", "in_progress"] },
    assignedAgent: { $ne: null },
  }).distinct("assignedAgent");

  // $geoNear omits documents without liveLocation, which hid newly verified
  // cleaners entirely. Admins can place these jobs manually; automatic offers
  // still require GPS to establish who is actually near the service address.
  const agents = await User.find({
    role: "agent",
    agentStatus: "verified",
    status: { $ne: "suspended" },
    online: true,
    currentOfferBooking: { $in: [null, booking._id] },
    _id: { $nin: busy },
  }).select("name area liveLocation").lean();

  return agents.map((a) => {
    const coords = a.liveLocation?.coordinates;
    const distanceKm = point && coords?.length === 2
      ? Number((haversineMeters([coords[0], coords[1]], point) / 1000).toFixed(1))
      : null;
    return { id: String(a._id), name: a.name, area: a.area ?? "", distanceKm, online: true };
  }).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.name.localeCompare(b.name)).slice(0, 50);
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
      await assignAgentToBooking(String(b._id), found.candidates[0].id, { source: "scheduler" });
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
    status: "upcoming",
    dispatchStatus: "offered",
    offerExpiresAt: { $lt: now },
  }).select("_id currentOfferAgent");

  for (const b of expired) {
    try {
      const agentId = b.currentOfferAgent ? String(b.currentOfferAgent) : null;
      const advanced = await Booking.updateOne(
        {
          _id: b._id,
          status: "upcoming",
          dispatchStatus: "offered",
          currentOfferAgent: b.currentOfferAgent ?? null,
          offerExpiresAt: { $lt: now },
        },
        {
          ...(agentId ? { $addToSet: { declinedAgents: new Types.ObjectId(agentId) as never } } : {}),
          $set: { currentOfferAgent: null, offerExpiresAt: null, dispatchStatus: "searching" },
        },
      );
      // Another tick/worker/decline already advanced this exact offer.
      if (advanced.modifiedCount === 0) continue;
      if (agentId) logBookingEvent(b._id, { type: "offer_expired", agentId });
      if (agentId) {
        await User.updateOne({ _id: agentId, currentOfferBooking: b._id }, { currentOfferBooking: null, currentOfferLeaseUntil: null });
        revokeAgentTracking(agentId, String(b._id));
        emitToUser(agentId, "offer_revoked", { bookingId: String(b._id) });
        await recordMissedOffer(agentId).catch((err) =>
          console.error("missed-offer tracking failed:", (err as Error).message),
        );
      }
      await offerNext(String(b._id));
    } catch (err) {
      console.error("offer expiry recovery failed:", String(b._id), (err as Error).message);
    }
  }
}

import { sweepAndRescheduleMissedSlots } from "./slotScheduler.service";

let workerHandle: NodeJS.Timeout | null = null;
let workerRunning = false;
let lastRecoveryRun = 0;
let lastSubscriptionRun = 0;
let lastReminderRun = 0;
const SUBSCRIPTION_TICK_MS = 30_000;

export function startDispatchWorker() {
  if (workerHandle) return;
  workerHandle = setInterval(() => {
    if (workerRunning) return;
    workerRunning = true;
    void (async () => {
      try {
        await sweepOffers();
        await sweepAndRescheduleMissedSlots().catch((err) =>
          console.error("missed slot sweep failed:", (err as Error).message),
        );
        if (Date.now() - lastRecoveryRun >= 10_000) {
          lastRecoveryRun = Date.now();
          await recoverDispatch();
        }
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
      } finally {
        workerRunning = false;
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
 * Repair abandoned reservations and retry unassigned jobs when availability
 * changes (GPS arrives, an agent comes online, or finishes another job).
 * Declines remain excluded; admin visibility is retained until an offer wins.
 */
export async function recoverDispatch(): Promise<void> {
  const staleLocks = await User.find({
    role: "agent", currentOfferBooking: { $ne: null },
    $or: [
      { currentOfferLeaseUntil: { $lte: new Date() } },
      { currentOfferLeaseUntil: null },
    ],
  }).select("_id");
  for (const agent of staleLocks) {
    await releaseDeadOfferLock(String(agent._id)).catch((err) =>
      console.error("offer lock recovery failed:", (err as Error).message));
  }
  const pending = await Booking.find({
    dispatchStatus: { $in: ["searching", "pending_admin"] },
    status: "upcoming", assignedAgent: null,
    "location.coordinates.0": { $exists: true },
  }).sort({ createdAt: 1 }).select("_id");
  for (const b of pending) {
    await offerNext(String(b._id)).catch((err) => console.error("dispatch recovery failed:", (err as Error).message));
  }
}

/** Preserve valid offers across restarts, including rolling multi-worker restarts. */
export async function resumeDispatch(): Promise<void> {
  await sweepOffers();
  await sweepAndRescheduleMissedSlots().catch((err) =>
    console.error("startup missed slot sweep failed:", (err as Error).message));
  await recoverDispatch();
}
