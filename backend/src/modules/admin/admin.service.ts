import { Booking, type BookingDocument } from "../booking/booking.model";
import { User, type UserDoc } from "../user/user.model";
import { Campaign } from "./campaign.model";
import { TriggeredAlert } from "../area-alert/areaAlert.model";
import { notifyUser } from "../notification/notification.service";
import { ApiError } from "../../shared/utils/ApiError";
import { PLANS } from "../catalog/catalog.data";

type BookingDoc = BookingDocument;

function displayStatus(b: BookingDoc): "upcoming" | "in_progress" | "completed" | "cancelled" {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "completed") return "completed";
  if (["enroute", "arrived", "in_progress"].includes(b.jobStatus)) return "in_progress";
  return "upcoming";
}

function mapBooking(b: BookingDoc) {
  const user = b.user as unknown as { name?: string } | null;
  return {
    id: b.id,
    customerName: (user && typeof user === "object" && user.name) || "Customer",
    vehicleType: b.vehicleType,
    vehicleName: b.vehicleName,
    packageName: b.packageName,
    date: b.date,
    slot: b.slot,
    society: b.society,
    price: b.price,
    status: displayStatus(b),
    agentName: b.agentName,
  };
}

export async function stats() {
  const bookings = await Booking.find();
  const agents = await User.find({ role: "agent" });
  const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const active = bookings.filter((b) => b.status === "upcoming").length;
  const alertsTriggered = await TriggeredAlert.countDocuments();
  return {
    revenue,
    activeBookings: active,
    agentsOnline: agents.filter((a) => a.online).length,
    agentsTotal: agents.length,
    alertsTriggered,
  };
}

export async function listBookings() {
  const bookings = await Booking.find().populate("user", "name").sort({ createdAt: -1 }).limit(200);
  return bookings.map(mapBooking);
}

export async function cancelBooking(id: string) {
  const booking = await Booking.findById(id).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");
  booking.status = "cancelled";
  await booking.save();
  return mapBooking(booking);
}

function mapAgent(a: UserDoc) {
  return {
    id: String(a.id),
    name: a.name,
    phone: a.phone,
    area: a.area ?? "",
    rating: a.rating ?? 0,
    jobsDone: a.jobsDone ?? 0,
    online: a.online ?? false,
    status: a.agentStatus ?? "pending",
    aadharNumber: a.aadharNumber ?? "",
    aadharFrontUrl: a.aadharFrontUrl ?? "",
    aadharBackUrl: a.aadharBackUrl ?? "",
  };
}

export async function listAgents() {
  const agents = await User.find({ role: "agent" }).sort({ createdAt: 1 });
  return agents.map(mapAgent);
}

export async function setAgentStatus(id: string, status: "verified" | "pending" | "suspended") {
  const agent = await User.findOneAndUpdate({ _id: id, role: "agent" }, { agentStatus: status }, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return mapAgent(agent);
}

export async function listPlans() {
  const out = [];
  for (const p of PLANS) {
    const subscribers = await User.countDocuments({ activePlan: p.id });
    out.push({ id: p.id, name: p.name, price: p.price, subscribers });
  }
  return out;
}

export async function listCampaigns() {
  return Campaign.find().sort({ createdAt: -1 }).limit(50);
}

export async function sendCampaign(input: { title: string; body: string; audience: string }) {
  const customers = await User.find({ role: "customer" }).select("_id").limit(500);
  for (const c of customers) {
    await notifyUser(c.id, { type: "system", title: input.title, body: input.body });
  }
  return Campaign.create({ ...input, sentCount: customers.length });
}
