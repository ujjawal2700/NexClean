import { Lead, type LeadDoc } from "./lead.model";
import { ApiError } from "../../shared/utils/ApiError";

type CreateLeadInput = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  location: string;
  deviceToken?: string;
};

function mapLead(l: LeadDoc) {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email ?? "",
    city: l.city,
    location: l.location,
    notified: l.notified,
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

export async function listLeads() {
  const leads = await Lead.find().sort({ createdAt: -1 });
  return leads.map(mapLead);
}

export async function deleteLead(id: string) {
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) throw ApiError.notFound("Lead not found");
}

export async function countLeads() {
  return Lead.countDocuments();
}
