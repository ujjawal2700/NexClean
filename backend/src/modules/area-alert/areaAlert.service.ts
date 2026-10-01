import { AreaAlertSettings, TriggeredAlert } from "./areaAlert.model";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { notifyUser } from "../notification/notification.service";
import { ApiError } from "../../shared/utils/ApiError";
import type { LngLat } from "../../shared/geo";

const EARTH_RADIUS_KM = 6378.1;

/** Get the singleton settings doc, creating it with defaults on first access. */
export async function getSettings() {
  const existing = await AreaAlertSettings.findOne();
  return existing ?? AreaAlertSettings.create({});
}

export async function updateSettings(patch: Record<string, unknown>) {
  const settings = await getSettings();
  settings.set(patch);
  await settings.save();
  return settings;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderTemplate(tmpl: string, society: string, minutes: number): string {
  return tmpl
    .replace(/\{\{\s*society\s*\}\}/g, society)
    .replace(/\{\{\s*minutes\s*\}\}/g, String(minutes));
}

/**
 * A cleaner may only alert a society they are demonstrably working: one they
 * have a job in today, or their own assigned service area.
 *
 * Without this, any verified cleaner could name ANY society and push a
 * notification to every customer living there — an unsolicited-marketing
 * button pointed at the whole customer base. Rate limiting caps the volume;
 * this caps the authority. Admins are unrestricted.
 *
 * Shared by both entry points (POST /agent/notify-area and
 * POST /area-alerts/trigger) so neither can be used to sidestep the other.
 */
export async function assertAgentMayAlert(agentId: string, society: string): Promise<void> {
  const agent = await User.findById(agentId).select("area agentStatus name");
  if (!agent || agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");

  const wanted = society.trim();
  const same = (a?: string | null) => (a ?? "").trim().toLowerCase() === wanted.toLowerCase();
  if (same(agent.area)) return;

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const societyMatch = new RegExp(`^${escapeRegex(wanted)}$`, "i");

  const job = await Booking.findOne({
    assignedAgent: agent._id,
    society: societyMatch,
    status: { $nin: ["cancelled"] },
    $or: [
      // Scheduled there today.
      { date: { $gte: dayStart, $lt: dayEnd } },
      // Or physically on the job right now, whatever the booking is dated.
      // "arrived" is a stronger statement of presence than the date field —
      // an early arrival or an overrunning job shouldn't lose the ability to
      // tell the neighbours.
      { jobStatus: { $in: ["enroute", "arrived", "in_progress"] } },
    ],
  }).select("_id");
  if (job) return;

  throw ApiError.forbidden(
    "You can only send an area alert for a society you're working today, or your own assigned area.",
  );
}

/**
 * Where the alert is centred, and whose job it is. For a cleaner, that's the
 * job they're on in this society (falling back to their live GPS); for an
 * admin, the most recent geotagged booking there. The job's own customer is
 * returned so they aren't told about the cleaner who is already at their car.
 */
async function alertOrigin(
  societyMatch: RegExp,
  agentId?: string,
): Promise<{ center: LngLat | null; jobCustomerId: string | null }> {
  if (agentId) {
    const job =
      (await Booking.findOne({
        assignedAgent: agentId,
        society: societyMatch,
        jobStatus: { $in: ["arrived", "in_progress", "enroute"] },
      })
        .sort({ updatedAt: -1 })
        .select("location user")) ??
      (await Booking.findOne({ assignedAgent: agentId, society: societyMatch, status: { $ne: "cancelled" } })
        .sort({ date: -1 })
        .select("location user"));
    const jobCenter = job?.location?.coordinates;
    if (jobCenter?.length === 2) {
      return { center: [jobCenter[0], jobCenter[1]], jobCustomerId: job ? String(job.user) : null };
    }
    const agent = await User.findById(agentId).select("liveLocation");
    const live = agent?.liveLocation?.coordinates;
    return {
      center: live?.length === 2 ? [live[0], live[1]] : null,
      jobCustomerId: job ? String(job.user) : null,
    };
  }
  const recent = await Booking.findOne({ society: societyMatch, "location.coordinates.1": { $exists: true } })
    .sort({ createdAt: -1 })
    .select("location");
  const c = recent?.location?.coordinates;
  return { center: c?.length === 2 ? [c[0], c[1]] : null, jobCustomerId: null };
}

/**
 * The Smart Area Alert engine: push a "NexClean Nearby" offer to customers
 * with a saved address within the admin's radius of the job.
 *
 * This used to match on the society *name* alone. That name is free text the
 * customer types ("Prestige Lakeside" vs "Prestige Lakeside Habitat"), so
 * neighbours almost never matched — in practice the only recipient was the
 * customer whose car was being cleaned. Addresses carry Google Places
 * coordinates, so distance is the real test; the exact-name match is kept for
 * older addresses saved without coordinates.
 */
export async function trigger(society: string, agentName?: string, agentId?: string) {
  const settings = await getSettings();
  if (!settings.enabled) throw ApiError.badRequest("Area alerts are currently disabled");

  const society_ = society.trim();
  const societyMatch = new RegExp(`^${escapeRegex(society_)}$`, "i");
  const { center, jobCustomerId } = await alertOrigin(societyMatch, agentId);

  const nearby: Record<string, unknown>[] = [{ addresses: { $elemMatch: { society: societyMatch } } }];
  if (center) {
    nearby.push({
      // Legacy [lng, lat] pairs; $centerSphere takes its radius in radians.
      "addresses.coordinates": { $geoWithin: { $centerSphere: [center, settings.radiusKm / EARTH_RADIUS_KM] } },
    });
  }

  const users = await User.find({
    role: "customer",
    $or: nearby,
    ...(jobCustomerId ? { _id: { $ne: jobCustomerId } } : {}),
  }).select("_id");

  const title = settings.title;
  const body = renderTemplate(settings.body, society_, settings.windowMinutes);

  // One customer's failed push must not stop the rest from being notified.
  const results = await Promise.allSettled(
    users.map((user) =>
      notifyUser(user.id, { type: "area_alert", title, body, data: { society: society_ } }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  results.forEach((r) => {
    if (r.status === "rejected") console.error("area alert notify failed:", (r.reason as Error)?.message);
  });

  const record = await TriggeredAlert.create({
    society: society_,
    agentName: agentName || "NexClean Specialist",
    sentCount: sent,
  });

  return record;
}

export async function listTriggered() {
  return TriggeredAlert.find().sort({ createdAt: -1 }).limit(50);
}
