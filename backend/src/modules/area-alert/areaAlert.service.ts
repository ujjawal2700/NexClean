import { AreaAlertSettings, TriggeredAlert } from "./areaAlert.model";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { notifyUser } from "../notification/notification.service";
import { ApiError } from "../../shared/utils/ApiError";

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
 * The Smart Area Alert engine: find customers with an address in the given
 * society and push them a personalized "NexClean Nearby" offer.
 * (Society-name match now; true geo-radius is a follow-up once we store
 * customer coordinates — the radius setting is already captured for it.)
 */
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

export async function trigger(society: string, agentName?: string) {
  const settings = await getSettings();
  if (!settings.enabled) throw ApiError.badRequest("Area alerts are currently disabled");

  const society_ = society.trim();
  const users = await User.find({
    addresses: { $elemMatch: { society: new RegExp(`^${escapeRegex(society_)}$`, "i") } },
  });

  const title = settings.title;
  const body = renderTemplate(settings.body, society_, settings.windowMinutes);

  let sent = 0;
  for (const user of users) {
    await notifyUser(user.id, { type: "area_alert", title, body, data: { society: society_ } });
    sent += 1;
  }

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
