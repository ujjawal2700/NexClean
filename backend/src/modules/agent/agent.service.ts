import { Booking, type BookingDocument } from "../booking/booking.model.js";
import { User } from "../user/user.model.js";
import { ApiError } from "../../shared/utils/ApiError.js";
import { trigger as triggerAreaAlert, assertAgentMayAlert } from "../area-alert/areaAlert.service.js";
import { maybeCreditReferrer } from "../promotions/referral.service.js";
import { toPoint, haversineMeters, isPlausibleMove, type LngLat } from "../../shared/geo.js";
import { emitToUser, emitToAdmins } from "../../shared/services/socket.js";
import { notifyUser } from "../notification/notification.service.js";
import { uploadImage } from "../../shared/utils/cloudinary.js";
import { payoutCalculator } from "../payout/payoutConfig.service.js";
import { markPaymentCollected } from "../payment/ledger.service.js";
import { broadcastJobStatus, forgetAgentBookings } from "../tracking/tracking.service.js";

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
  const beforePhotos =
    b.beforePhotos && b.beforePhotos.length > 0
      ? b.beforePhotos
      : b.beforePhotoUrl
        ? [b.beforePhotoUrl]
        : [];
  const afterPhotos =
    b.afterPhotos && b.afterPhotos.length > 0
      ? b.afterPhotos
      : b.afterPhotoUrl
        ? [b.afterPhotoUrl]
        : [];

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
    coordinates:
      b.location?.coordinates && b.location.coordinates.length === 2
        ? { lat: b.location.coordinates[1], lng: b.location.coordinates[0] }
        : null,
    price: b.price,
    payout: jobPayout(b, payoutOf),
    status: b.jobStatus,
    hasBefore: beforePhotos.length >= 4 || b.hasBefore,
    hasAfter: afterPhotos.length >= 4 || b.hasAfter,
    beforePhotos,
    afterPhotos,
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

  const beforeCount = booking.beforePhotos?.length ?? (booking.beforePhotoUrl ? 1 : 0);
  const afterCount = booking.afterPhotos?.length ?? (booking.afterPhotoUrl ? 1 : 0);

  // Gating requirements:
  // 1. Moving from arrived to in_progress (Start cleaning): Must have at least 4 before photos (or hasBefore flag).
  if (current === "arrived" && beforeCount < 4 && !booking.hasBefore) {
    throw ApiError.badRequest("Upload at least 4 before photos (4 mandatory) to start cleaning");
  }

  // 2. Moving from in_progress to completed (Mark complete): Must have at least 4 after photos (or hasAfter flag).
  if (current === "in_progress" && afterCount < 4 && !booking.hasAfter) {
    throw ApiError.badRequest("Upload at least 4 after photos (4 mandatory) to mark complete");
  }

  const next = JOB_FLOW[Math.min(idx + 1, JOB_FLOW.length - 1)];
  const payoutOf = await payoutCalculator();
  booking.jobStatus = next;
  // Stamp the transitions so the wash's real duration can be reported later.
  if (next === "in_progress" && !booking.jobStartedAt) booking.jobStartedAt = new Date();
  if (next === "completed") {
    booking.jobCompletedAt = new Date();
    booking.status = "completed";
    // Freeze the earnings at today's rule. Editing the rule later must not
    // retroactively change what an agent was already told they had earned.
    booking.agentPayout = payoutOf(booking.price);
    await User.updateOne({ _id: agentId }, { $inc: { jobsDone: 1 } });
  }
  await booking.save();

  // The customer's tracking screen is driven entirely by these events, so it
  // has to hear about the change before any of the slower follow-up work.
  // "completed" also drops the job out of the trackable set, which the cached
  // agent→bookings lookup would otherwise keep serving for up to its TTL.
  forgetAgentBookings(agentId);
  broadcastJobStatus(booking);

  const customerId = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);

  // Push + in-app feed entry for every customer-visible milestone, each deep
  // linking straight back to the tracking screen. The socket event above
  // covers the tab that's already open on that screen; this is what reaches
  // the customer when it isn't.
  const STATUS_NOTICE: Partial<Record<JobStatus, { title: string; body: string }>> = {
    enroute: {
      title: "🚗 Your cleaner is on the way",
      body: `${booking.agentName ?? "Your cleaner"} is heading to you for the ${booking.packageName}.`,
    },
    arrived: {
      title: "📍 Your cleaner has arrived",
      body: `${booking.agentName ?? "Your cleaner"} has arrived and will begin shortly.`,
    },
    in_progress: {
      title: "🧽 Service started",
      body: `Your ${booking.vehicleName} wash is now in progress.`,
    },
    completed: {
      title: "✅ Service completed",
      body: `Your ${booking.vehicleName} is sparkling clean! Tap to view the before/after photos.`,
    },
  };
  const notice = STATUS_NOTICE[next];
  if (notice) {
    void notifyUser(customerId, {
      type: "booking",
      title: notice.title,
      body: notice.body,
      data: { bookingId: String(booking._id), url: `/app/track/${booking._id}` },
    }).catch((err) => console.error("status notification failed:", (err as Error).message));
  }

  // A completed service is a qualifying referral milestone for the customer.
  // Fire-and-forget: never block job completion on the reward.
  if (next === "completed") {
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
  options: {
    image?: string;
    action?: "add" | "remove";
    index?: number;
  } = {},
) {
  const booking = await getOwnedJob(agentId, bookingId);
  const { image, action = "add", index } = options;

  if (action === "remove") {
    if (typeof index === "number") {
      if (kind === "before") {
        if (booking.beforePhotos && index >= 0 && index < booking.beforePhotos.length) {
          booking.beforePhotos.splice(index, 1);
        }
      } else {
        if (booking.afterPhotos && index >= 0 && index < booking.afterPhotos.length) {
          booking.afterPhotos.splice(index, 1);
        }
      }
    }
  } else {
    if (image) {
      const currentList = kind === "before" ? (booking.beforePhotos || []) : (booking.afterPhotos || []);
      if (currentList.length >= 8) {
        throw ApiError.badRequest(`Maximum 8 ${kind} photos allowed (4 mandatory + 4 optional)`);
      }

      let url = "";
      try {
        url = await uploadImage(image);
      } catch (err) {
        console.error(
          `[agent:setPhoto] ${kind} photo upload failed for booking ${bookingId}:`,
          (err as Error).message,
        );
        url = image;
      }

      if (url) {
        if (kind === "before") {
          if (!booking.beforePhotos) booking.beforePhotos = [];
          booking.beforePhotos.push(url);
        } else {
          if (!booking.afterPhotos) booking.afterPhotos = [];
          booking.afterPhotos.push(url);
        }
      }
    }
  }

  if (kind === "before") {
    booking.hasBefore = (booking.beforePhotos?.length ?? 0) >= 4;
    booking.beforePhotoUrl = booking.beforePhotos?.[0] || "";
  } else {
    booking.hasAfter = (booking.afterPhotos?.length ?? 0) >= 4;
    booking.afterPhotoUrl = booking.afterPhotos?.[0] || "";
  }

  booking.markModified("beforePhotos");
  booking.markModified("afterPhotos");
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
  const prev = prevLoc?.coordinates;
  const prevPoint: LngLat | null = prev && prev.length === 2 ? [prev[0], prev[1]] : null;
  if (isPlausibleMove(prevPoint, prevTime, [newLng, newLat])) return true;
  console.warn(
    `[GPS Spoofing Check] Agent ${agentId} reported an impossible jump between fixes. Location update ignored.`,
  );
  return false;
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

  // The cleaner's own record of what they picked up.
  void notifyUser(agentId, {
    type: "booking",
    title: "✅ Job claimed",
    body: `${booking.packageName} · ${booking.vehicleName} · ${booking.slot}`,
    data: { bookingId: String(booking._id), role: "agent" },
  }).catch(() => {});

  // Notify the customer.
  const cid = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
  forgetAgentBookings(agentId);
  broadcastJobStatus(booking);
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
