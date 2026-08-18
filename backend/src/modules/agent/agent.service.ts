import { Booking, type BookingDocument } from "../booking/booking.model.js";
import { User } from "../user/user.model.js";
import { ApiError } from "../../shared/utils/ApiError.js";
import { trigger as triggerAreaAlert, assertAgentMayAlert } from "../area-alert/areaAlert.service.js";
import { maybeCreditReferrer } from "../promotions/referral.service.js";
import { toPoint, haversineMeters, type LngLat } from "../../shared/geo.js";
import { emitToUser, emitToAdmins } from "../../shared/services/socket.js";
import { notifyUser } from "../notification/notification.service.js";
import { uploadImage } from "../../shared/utils/cloudinary.js";
import { payoutCalculator } from "../payout/payoutConfig.service.js";
import { markPaymentCollected } from "../payment/ledger.service.js";

const JOB_FLOW = ["assigned", "enroute", "arrived", "in_progress", "completed"] as const;
type JobStatus = (typeof JOB_FLOW)[number];

/** Real distance (km) between the agent and a booking, or null when unknown. */
function jobDistanceKm(b: BookingDocument, agentPoint?: LngLat): number | null {
  const coords = (b.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  if (!agentPoint || !coords || coords.length !== 2) return null;
  return Number((haversineMeters(agentPoint, [coords[0], coords[1]]) / 1000).toFixed(1));
}

/**
 * What this job pays. A completed job quotes the amount frozen on the booking;
 * anything still open is quoted from the current admin-set rule, so an agent
 * always sees today's rate for work they haven't finished yet.
 */
function jobPayout(b: BookingDocument, payoutOf: (price: number) => number): number {
  return b.agentPayout ?? payoutOf(b.price);
}

/** Shape a booking into the agent-facing "job" the frontend expects. */
function mapJob(b: BookingDocument, payoutOf: (price: number) => number, agentPoint?: LngLat) {
  const user = b.user as unknown as { name?: string } | null;
  return {
    id: b.id,
    customerName: (user && typeof user === "object" && user.name) || "Customer",
    vehicleType: b.vehicleType,
    vehicleName: b.vehicleName,
    packageName: b.packageName,
    date: b.date,
    slot: b.slot,
    addressLabel: b.addressLabel,
    addressLine: b.addressLine,
    society: b.society,
    distanceKm: jobDistanceKm(b, agentPoint),
    price: b.price,
    payout: jobPayout(b, payoutOf),
    status: b.jobStatus,
    hasBefore: b.hasBefore,
    hasAfter: b.hasAfter,
  };
}

/** Current live coordinates of an agent as [lng, lat], or undefined. */
async function getAgentPoint(agentId: string): Promise<LngLat | undefined> {
  const agent = await User.findById(agentId).select("liveLocation");
  const coords = (agent?.liveLocation as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  return coords && coords.length === 2 ? [coords[0], coords[1]] : undefined;
}

export async function listJobs(agentId: string) {
  const [agentPoint, payoutOf] = await Promise.all([getAgentPoint(agentId), payoutCalculator()]);
  const bookings = await Booking.find({ assignedAgent: agentId })
    .populate("user", "name")
    .sort({ createdAt: -1 });
  return bookings.map((b) => mapJob(b, payoutOf, agentPoint));
}

async function getOwnedJob(agentId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, assignedAgent: agentId }).populate("user", "name");
  if (!booking) throw ApiError.notFound("Job not found");
  return booking;
}

export async function advanceStatus(agentId: string, bookingId: string) {
  const booking = await getOwnedJob(agentId, bookingId);
  const current = booking.jobStatus as JobStatus;
  const idx = JOB_FLOW.indexOf(current);

  // Already at the terminal state. Without this, the Math.min() clamp below
  // re-entered the "completed" branch on every extra call and incremented
  // jobsDone again each time, letting an agent inflate their own stats.
  if (idx === JOB_FLOW.length - 1) {
    throw ApiError.badRequest("This job is already completed");
  }

  if (current === "in_progress" && !(booking.hasBefore && booking.hasAfter)) {
    throw ApiError.badRequest("Add before & after photos before completing");
  }

  const next = JOB_FLOW[Math.min(idx + 1, JOB_FLOW.length - 1)];
  const payoutOf = await payoutCalculator();
  booking.jobStatus = next;
  if (next === "completed") {
    booking.status = "completed";
    // Freeze the earnings at today's rule. Editing the rule later must not
    // retroactively change what an agent was already told they had earned.
    booking.agentPayout = payoutOf(booking.price);
    await User.updateOne({ _id: agentId }, { $inc: { jobsDone: 1 } });
  }
  await booking.save();

  // A completed service is a qualifying referral milestone for the customer.
  // Fire-and-forget: never block job completion on the reward.
  if (next === "completed") {
    const customerId = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
    void maybeCreditReferrer(customerId).catch((err) =>
      console.error("referral credit failed:", (err as Error).message),
    );

    // The cleaner has just been paid in cash, so the ledger row for this
    // booking becomes "paid". Fire-and-forget for the same reason as above —
    // a bookkeeping write must never leave a cleaner unable to close a job.
    void markPaymentCollected(booking.id).catch((err) =>
      console.error("payment collection mark failed:", (err as Error).message),
    );
  }

  return mapJob(booking, payoutOf, await getAgentPoint(agentId));
}

export async function setPhoto(
  agentId: string,
  bookingId: string,
  kind: "before" | "after",
  image?: string,
) {
  const booking = await getOwnedJob(agentId, bookingId);

  // Store the image when one is supplied. `image` stays optional so older
  // agent clients keep working, but the URL is what makes the flag meaningful.
  //
  // A failed upload must not throw: completion is gated on hasBefore/hasAfter,
  // so letting a Cloudinary outage bubble up left the cleaner standing at a
  // finished car unable to close the job. Record the flag, and leave the URL
  // empty so the missing evidence is visible to admins rather than silent.
  let url = "";
  if (image) {
    try {
      url = await uploadImage(image);
    } catch (err) {
      console.error(
        `[agent:setPhoto] ${kind} photo upload failed for booking ${bookingId}:`,
        (err as Error).message,
      );
    }
  }

  if (kind === "before") {
    booking.hasBefore = true;
    if (url) booking.beforePhotoUrl = url;
  } else {
    booking.hasAfter = true;
    if (url) booking.afterPhotoUrl = url;
  }
  await booking.save();
  const [payoutOf, agentPoint] = await Promise.all([payoutCalculator(), getAgentPoint(agentId)]);
  return mapJob(booking, payoutOf, agentPoint);
}

export async function summary(agentId: string) {
  const [jobs, payoutOf] = await Promise.all([
    Booking.find({ assignedAgent: agentId }),
    payoutCalculator(),
  ]);
  const isToday = (d: Date) => new Date(d).toDateString() === new Date().toDateString();
  const todays = jobs.filter((j) => isToday(j.date));
  const completedToday = todays.filter((j) => j.jobStatus === "completed");
  const payout = (j: (typeof jobs)[number]) => j.agentPayout ?? payoutOf(j.price);
  return {
    jobsToday: todays.length,
    completedToday: completedToday.length,
    earnedToday: completedToday.reduce((s, j) => s + payout(j), 0),
    potentialToday: todays.reduce((s, j) => s + payout(j), 0),
  };
}

type Coords = { lat?: number; lng?: number };

/** Build a location patch from optional coords (skips when not provided). */
function locationPatch(coords?: Coords) {
  const point = toPoint(coords?.lat, coords?.lng);
  return point ? { liveLocation: point, locationUpdatedAt: new Date() } : {};
}

function isValidLocationUpdate(
  prevLoc: { coordinates?: number[] } | undefined,
  prevTime: Date | null | undefined,
  newLat: number,
  newLng: number,
  agentId: string,
): boolean {
  if (!prevLoc || !prevLoc.coordinates || prevLoc.coordinates.length !== 2 || !prevTime) {
    return true; // no previous location/time to compare
  }
  const distanceMeters = haversineMeters(
    [prevLoc.coordinates[0], prevLoc.coordinates[1]],
    [newLng, newLat],
  );
  const timeDiffSeconds = (Date.now() - new Date(prevTime).getTime()) / 1000;
  if (distanceMeters > 100 && timeDiffSeconds > 0) {
    const speedKmH = (distanceMeters / 1000) / (timeDiffSeconds / 3600);
    if (speedKmH > 150) {
      console.warn(
        `[GPS Spoofing Check] Agent ${agentId} anomaly: moved ${distanceMeters.toFixed(0)}m in ${timeDiffSeconds.toFixed(1)}s (${speedKmH.toFixed(1)} km/h). Location update ignored.`,
      );
      return false;
    }
  }
  return true;
}

export async function setOnline(agentId: string, online: boolean, coords?: Coords) {
  const agentCheck = await User.findById(agentId);
  if (!agentCheck) throw ApiError.notFound("Agent not found");
  if (online && agentCheck.agentStatus !== "verified") {
    throw ApiError.badRequest("Agent is not verified");
  }

  // Going online counts as an immediate heartbeat so the badge flips live right away.
  let update: any;
  if (online) {
    update = { online, lastSeenAt: new Date() };
    if (coords && coords.lat != null && coords.lng != null) {
      if (isValidLocationUpdate(agentCheck.liveLocation as any, agentCheck.locationUpdatedAt, coords.lat, coords.lng, agentId)) {
        Object.assign(update, locationPatch(coords));
      }
    }
  } else {
    update = { online };
  }
  const agent = await User.findByIdAndUpdate(agentId, update, { new: true });
  return agent!;
}

export async function heartbeat(agentId: string, coords?: Coords) {
  const agent = await User.findById(agentId);
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") {
    throw ApiError.badRequest("Agent is not verified");
  }

  const update: any = { lastSeenAt: new Date() };
  if (coords && coords.lat != null && coords.lng != null) {
    if (isValidLocationUpdate(agent.liveLocation as any, agent.locationUpdatedAt, coords.lat, coords.lng, agentId)) {
      Object.assign(update, locationPatch(coords));
    }
  }
  const updatedAgent = await User.findByIdAndUpdate(agentId, update, { new: true });
  return updatedAgent!;
}

/** Persist a streamed live location (from the socket channel). Best-effort, no throw. */
export async function updateAgentLocation(agentId: string, lat: number, lng: number) {
  const agent = await User.findById(agentId).select("liveLocation locationUpdatedAt agentStatus");
  if (!agent || agent.agentStatus !== "verified") return;
  if (!isValidLocationUpdate(agent.liveLocation as any, agent.locationUpdatedAt, lat, lng, agentId)) {
    return;
  }
  const patch = locationPatch({ lat, lng });
  if (!("liveLocation" in patch)) return;
  await User.updateOne({ _id: agentId, role: "agent" }, patch);
}

/** Agent notifies nearby customers (Smart Area Alert) for a society. */
/**
 * Send a "cleaner is nearby" alert to customers in a society.
 * Authorization lives in areaAlert.service so both entry points share it.
 */
export async function notifyArea(agentId: string, society: string) {
  const agent = await User.findById(agentId).select("name");
  await assertAgentMayAlert(agentId, society);
  return triggerAreaAlert(society.trim(), agent?.name);
}

/**
 * Return today's bookings that are in the dispatch pool (unassigned).
 * These are visible to all online verified agents as "available work"
 * they can claim directly — useful when the browser was closed during dispatch.
 */
export async function listAvailableJobs(agentId: string) {
  const agent = await User.findById(agentId);
  if (!agent || agent.agentStatus !== "verified") return [];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    status: "upcoming",
    dispatchStatus: { $in: ["searching", "pending_admin", "offered"] },
    assignedAgent: null,
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("user", "name")
    .sort({ date: 1, slot: 1 })
    .limit(20);

  const [agentPoint, payoutOf] = await Promise.all([getAgentPoint(agentId), payoutCalculator()]);
  return bookings.map((b) => mapJob(b, payoutOf, agentPoint));
}

/**
 * An agent directly claims an available booking from the pool.
 * Works like accepting an offer but skips the offer-lock step.
 * The booking must still be unassigned at the time of the claim.
 */
export async function claimJob(agentId: string, bookingId: string) {
  const agent = await User.findById(agentId);
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");

  // Atomically grab the booking if it's still unclaimed.
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: "upcoming",
      dispatchStatus: { $in: ["searching", "pending_admin", "offered"] },
      assignedAgent: null,
    },
    {
      $set: {
        assignedAgent: agent._id,
        agentName: agent.name,
        dispatchStatus: "assigned",
        jobStatus: "assigned",
        assignedAt: new Date(),
        currentOfferAgent: null,
        offerExpiresAt: null,
      },
    },
    { new: true },
  ).populate("user", "name");

  if (!booking) throw ApiError.badRequest("This job is no longer available");

  // Release any other agent's offer lock on this booking.
  await User.updateMany({ currentOfferBooking: booking._id }, { currentOfferBooking: null });

  // Notify the customer.
  const cid = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
  emitToUser(cid, "booking_assigned", { bookingId: String(booking._id), agentName: agent.name });
  emitToAdmins("dispatch_update", { at: Date.now() });
  void notifyUser(cid, {
    type: "booking",
    title: "✅ Cleaner on the way",
    body: `${agent.name} has been assigned to your ${booking.packageName}.`,
    data: { bookingId: String(booking._id) },
  }).catch(() => {});

  const [agentPoint, payoutOf] = await Promise.all([getAgentPoint(agentId), payoutCalculator()]);
  return mapJob(booking, payoutOf, agentPoint);
}
