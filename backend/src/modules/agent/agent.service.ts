import { Booking, type BookingDocument } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { trigger as triggerAreaAlert } from "../area-alert/areaAlert.service";

const JOB_FLOW = ["assigned", "enroute", "arrived", "in_progress", "completed"] as const;
type JobStatus = (typeof JOB_FLOW)[number];

/** Shape a booking into the agent-facing "job" the frontend expects. */
function mapJob(b: BookingDocument) {
  const user = b.user as unknown as { name?: string } | null;
  const lastByte = parseInt(b.id.slice(-2), 16) || 12;
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
    distanceKm: Number((0.8 + (lastByte % 40) / 10).toFixed(1)),
    price: b.price,
    payout: Math.round(b.price * 0.7),
    status: b.jobStatus,
    hasBefore: b.hasBefore,
    hasAfter: b.hasAfter,
  };
}

export async function listJobs(agentId: string) {
  const bookings = await Booking.find({ assignedAgent: agentId })
    .populate("user", "name")
    .sort({ createdAt: -1 });
  return bookings.map(mapJob);
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
  return mapJob(booking);
}

export async function setPhoto(agentId: string, bookingId: string, kind: "before" | "after") {
  const booking = await getOwnedJob(agentId, bookingId);
  if (kind === "before") booking.hasBefore = true;
  else booking.hasAfter = true;
  await booking.save();
  return mapJob(booking);
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

export async function setOnline(agentId: string, online: boolean) {
  // Going online counts as an immediate heartbeat so the badge flips live right away.
  const update = online ? { online, lastSeenAt: new Date() } : { online };
  const agent = await User.findByIdAndUpdate(agentId, update, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return agent;
}

/** Keeps the agent's "live" status fresh; the app calls this on an interval while open. */
export async function heartbeat(agentId: string) {
  const agent = await User.findByIdAndUpdate(agentId, { lastSeenAt: new Date() }, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return agent;
}

/** Agent notifies nearby customers (Smart Area Alert) for a society. */
export async function notifyArea(agentId: string, society: string) {
  const agent = await User.findById(agentId);
  return triggerAreaAlert(society, agent?.name);
}
