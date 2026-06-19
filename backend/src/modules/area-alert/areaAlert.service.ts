import { AreaAlertSettings, TriggeredAlert } from "./areaAlert.model";
import { User } from "../user/user.model";
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
