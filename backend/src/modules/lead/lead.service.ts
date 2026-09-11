import { Lead, type LeadDoc } from "./lead.model";
import { ApiError } from "../../shared/utils/ApiError";
import { User } from "../user/user.model";
import { toPoint } from "../../shared/geo";

type CreateLeadInput = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  location: string;
  deviceToken?: string;
};

function mapLead(l: LeadDoc) {
  const coords = (l as unknown as { point?: { coordinates?: number[] } }).point?.coordinates;
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email ?? "",
    city: l.city,
    location: l.location,
    point: coords && coords.length === 2 ? { lat: coords[1], lng: coords[0] } : null,
    notified: l.notified,
    status: (l as unknown as { status?: string }).status ?? "new",
    createdAt: (l as unknown as { createdAt: Date }).createdAt,
  };
}

/** Upsert a lead by phone — if the user re-submits, update their city/location. */
export async function createLead(input: CreateLeadInput) {
  const lead = await Lead.findOneAndUpdate(
    { phone: input.phone },
    {
      name: input.name,
      phone: input.phone,
      email: input.email ?? "",
      city: input.city,
      location: input.location,
      deviceToken: input.deviceToken ?? "",
      notified: false,
    },
    { upsert: true, new: true },
  );
  return mapLead(lead);
}

/**
 * An existing, authenticated customer asking us to cover an address outside
 * every drawn geofence — see catalog.controller.ts's getServiceCheckCtl for
 * the check that leads here, and AddAddressModal for where it's triggered.
 * Reuses the same Lead record and admin queue as the unserviced-city
 * waitlist; `city` is deliberately left untouched (not blanked) rather than
 * set from here, since a customer may already have one on file from signup.
 */
export async function requestArea(userId: string, input: { lat: number; lng: number; label?: string }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const point = toPoint(input.lat, input.lng);
  if (!point) throw ApiError.badRequest("A valid lat/lng is required");

  const lead = await Lead.findOneAndUpdate(
    { phone: user.phone },
    {
      name: user.name || "NexClean Customer",
      phone: user.phone,
      email: user.email ?? "",
      location: input.label?.trim() || `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`,
      point,
      notified: false,
    },
    { upsert: true, new: true },
  );
  return mapLead(lead);
}

export async function listLeads() {
  const leads = await Lead.find().sort({ createdAt: -1 });
  return leads.map(mapLead);
}

export async function deleteLead(id: string) {
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) throw ApiError.notFound("Lead not found");
}

export async function updateLeadStatus(id: string, status: "new" | "contacted" | "converted") {
  const lead = await Lead.findById(id);
  if (!lead) throw ApiError.notFound("Lead not found");
  lead.status = status;
  await lead.save();
  return mapLead(lead);
}


export async function countLeads() {
  return Lead.countDocuments({ status: { $ne: "converted" } });
}

