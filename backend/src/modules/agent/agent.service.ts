import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { trigger as triggerAreaAlert } from "../area-alert/areaAlert.service";
import { maybeCreditReferrer } from "../promotions/referral.service";
import { toPoint, haversineMeters, type LngLat } from "../../shared/geo";

const JOB_FLOW = ["assigned", "enroute", "arrived", "in_progress", "completed"] as const;
type JobStatus = (typeof JOB_FLOW)[number];

/** Real distance (km) between the agent and a booking, or null when unknown. */
function jobDistanceKm(b: BookingDocument, agentPoint?: LngLat): number | null {
  const coords = (b.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  if (!agentPoint || !coords || coords.length !== 2) return null;
  return Number((haversineMeters(agentPoint, [coords[0], coords[1]]) / 1000).toFixed(1));
}

/** Shape a booking into the agent-facing "job" the frontend expects. */
function mapJob(b: BookingDocument, agentPoint?: LngLat) {
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
    payout: Math.round(b.price * 0.7),
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
  const agentPoint = await getAgentPoint(agentId);
  const bookings = await Booking.find({ assignedAgent: agentId })
    .populate("user", "name")
    .sort({ createdAt: -1 });
  return bookings.map((b) => mapJob(b, agentPoint));
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

  if (current === "in_progress" && !(booking.hasBefore && booking.hasAfter)) {
    throw ApiError.badRequest("Add before & after photos before completing");
  }

  const next = JOB_FLOW[Math.min(idx + 1, JOB_FLOW.length - 1)];
  booking.jobStatus = next;
  if (next === "completed") {
    booking.status = "completed";
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
  }

  return mapJob(booking, await getAgentPoint(agentId));
}

export async function setPhoto(agentId: string, bookingId: string, kind: "before" | "after") {
  const booking = await getOwnedJob(agentId, bookingId);
  if (kind === "before") booking.hasBefore = true;
  else booking.hasAfter = true;
  await booking.save();
  return mapJob(booking, await getAgentPoint(agentId));
}

export async function summary(agentId: string) {
  const jobs = await Booking.find({ assignedAgent: agentId });
  const isToday = (d: Date) => new Date(d).toDateString() === new Date().toDateString();
  const todays = jobs.filter((j) => isToday(j.date));
  const completedToday = todays.filter((j) => j.jobStatus === "completed");
  return {
    jobsToday: todays.length,
    completedToday: completedToday.length,
    earnedToday: completedToday.reduce((s, j) => s + Math.round(j.price * 0.7), 0),
    potentialToday: todays.reduce((s, j) => s + Math.round(j.price * 0.7), 0),
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
  // Going online counts as an immediate heartbeat so the badge flips live right away.
  let update: any;
  if (online) {
    update = { online, lastSeenAt: new Date() };
    if (coords && coords.lat != null && coords.lng != null) {
      const agent = await User.findById(agentId).select("liveLocation locationUpdatedAt");
      if (agent && isValidLocationUpdate(agent.liveLocation as any, agent.locationUpdatedAt, coords.lat, coords.lng, agentId)) {
        Object.assign(update, locationPatch(coords));
      }
    }
  } else {
    update = { online };
  }
  const agent = await User.findByIdAndUpdate(agentId, update, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return agent;
}

/** Keeps the agent's "live" status (and optionally location) fresh. */
export async function heartbeat(agentId: string, coords?: Coords) {
  const update: any = { lastSeenAt: new Date() };
  if (coords && coords.lat != null && coords.lng != null) {
    const agent = await User.findById(agentId).select("liveLocation locationUpdatedAt");
    if (agent && isValidLocationUpdate(agent.liveLocation as any, agent.locationUpdatedAt, coords.lat, coords.lng, agentId)) {
      Object.assign(update, locationPatch(coords));
    }
  }
  const agent = await User.findByIdAndUpdate(agentId, update, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return agent;
}

/** Persist a streamed live location (from the socket channel). Best-effort, no throw. */
export async function updateAgentLocation(agentId: string, lat: number, lng: number) {
  const agent = await User.findById(agentId).select("liveLocation locationUpdatedAt");
  if (!agent) return;
  if (!isValidLocationUpdate(agent.liveLocation as any, agent.locationUpdatedAt, lat, lng, agentId)) {
    return;
  }
  const patch = locationPatch({ lat, lng });
  if (!("liveLocation" in patch)) return;
  await User.updateOne({ _id: agentId, role: "agent" }, patch);
}

/** Agent notifies nearby customers (Smart Area Alert) for a society. */
export async function notifyArea(agentId: string, society: string) {
  const agent = await User.findById(agentId);
  return triggerAreaAlert(society, agent?.name);
}
