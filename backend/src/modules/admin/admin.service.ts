import { Booking, type BookingDocument } from "../booking/booking.model";
import { User, type UserDoc } from "../user/user.model";
import { Payment, type PaymentDocument } from "../payment/payment.model";
import { Campaign } from "./campaign.model";
import { TriggeredAlert } from "../area-alert/areaAlert.model";
import { notifyUser } from "../notification/notification.service";
import { ApiError } from "../../shared/utils/ApiError";
import { agentLiveSince, isAgentLive } from "../user/presence";
import * as planService from "../catalog/plan.service";
import type { PlanDoc } from "../catalog/plan.model";
import type { PlanPrices } from "../catalog/catalog.data";
import { listCategories } from "../catalog/category.service";

type BookingDoc = BookingDocument;
type DisplayStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

function displayStatus(b: BookingDoc): DisplayStatus {
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
    assignedAgentId: b.assignedAgent ? String(b.assignedAgent) : null,
  };
}

export async function stats() {
  const bookings = await Booking.find();
  const agents = await User.find({ role: "agent" });
  const totalUsers = await User.countDocuments({ role: "customer" });
  const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const active = bookings.filter((b) => b.status === "upcoming").length;
  const activeServices = bookings.filter((b) => displayStatus(b) === "in_progress").length;
  const alertsTriggered = await TriggeredAlert.countDocuments();
  return {
    revenue,
    activeBookings: active,
    activeServices,
    totalUsers,
    agentsOnline: agents.filter((a) => isAgentLive(a)).length,
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

export async function setBookingStatus(id: string, status: DisplayStatus) {
  const booking = await Booking.findById(id).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  if (status === "cancelled") {
    booking.status = "cancelled";
  } else if (status === "completed") {
    booking.status = "completed";
    booking.jobStatus = "completed";
  } else if (status === "in_progress") {
    booking.status = "upcoming";
    booking.jobStatus = "in_progress";
  } else {
    booking.status = "upcoming";
    booking.jobStatus = "assigned";
  }

  await booking.save();
  return mapBooking(booking);
}

export async function assignAgent(bookingId: string, agentId: string) {
  const booking = await Booking.findById(bookingId).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const agent = await User.findOne({ _id: agentId, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  if (agent.agentStatus !== "verified") throw ApiError.badRequest("Agent is not verified");

  booking.assignedAgent = agent.id;
  booking.agentName = agent.name;
  if (booking.jobStatus === "completed") booking.jobStatus = "assigned";
  await booking.save();
  return mapBooking(booking);
}

export async function autoAssignBooking(bookingId: string) {
  const booking = await Booking.findById(bookingId).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const candidates = await User.find({
    role: "agent",
    agentStatus: "verified",
    online: true,
    lastSeenAt: { $gte: agentLiveSince() },
  });
  if (candidates.length === 0) throw ApiError.badRequest("No available agents to auto-assign");

  const inSameArea = candidates.filter((a) => a.area && booking.society && a.area === booking.society);
  const pool = inSameArea.length > 0 ? inSameArea : candidates;

  const loads = await Promise.all(
    pool.map(async (a) => ({
      agent: a,
      load: await Booking.countDocuments({ assignedAgent: a._id, status: "upcoming" }),
    })),
  );
  loads.sort((x, y) => x.load - y.load);
  const chosen = loads[0]!.agent;

  booking.assignedAgent = chosen.id;
  booking.agentName = chosen.name;
  if (booking.jobStatus === "completed") booking.jobStatus = "assigned";
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
    online: isAgentLive(a),
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

export async function updateAgentArea(id: string, area: string) {
  const agent = await User.findOneAndUpdate({ _id: id, role: "agent" }, { area }, { new: true });
  if (!agent) throw ApiError.notFound("Agent not found");
  return mapAgent(agent);
}

export async function getAgent(id: string) {
  const agent = await User.findOne({ _id: id, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  const bookings = await Booking.find({ assignedAgent: agent._id }).select("price status");
  const completedJobs = bookings.filter((b) => b.status === "completed").length;
  const cancelledJobs = bookings.filter((b) => b.status === "cancelled").length;
  const totalEarnings = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);

  return {
    ...mapAgent(agent),
    joinedAt: agent.get("createdAt") as Date,
    totalBookings: bookings.length,
    completedJobs,
    cancelledJobs,
    totalEarnings,
  };
}

export async function getAgentActivity(id: string) {
  const agent = await User.findOne({ _id: id, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");

  const bookings = await Booking.find({ assignedAgent: agent._id })
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(100);

  return { bookings: bookings.map(mapBooking) };
}

async function mapPlanWithSubscribers(p: PlanDoc) {
  const id = String(p.id);
  const subscribers = await User.countDocuments({ activePlan: id });
  const prices = (p.prices ?? {}) as Record<string, number>;
  const values = Object.values(prices).filter((n): n is number => typeof n === "number");
  const price = values.length ? Math.min(...values) : 0;
  return { id, name: p.name, prices, price, washesPerMonth: p.washesPerMonth, active: p.active, subscribers };
}

export async function listPlans() {
  const plans = await planService.listPlans();
  return Promise.all(plans.map((p) => mapPlanWithSubscribers(p)));
}

export async function createPlan(input: { name: string; prices: PlanPrices; washesPerMonth: number }) {
  const plan = await planService.createPlan(input);
  return mapPlanWithSubscribers(plan);
}

export async function updatePlan(
  id: string,
  patch: { name?: string; prices?: PlanPrices; washesPerMonth?: number; active?: boolean },
) {
  const plan = await planService.updatePlan(id, patch);
  return mapPlanWithSubscribers(plan);
}

export async function deletePlan(id: string) {
  const subscribers = await User.countDocuments({ activePlan: id });
  if (subscribers > 0) throw ApiError.badRequest("Cannot delete a plan with active subscribers");
  await planService.deletePlan(id);
}

export const AUDIENCES = ["All customers", "Active customers", "Lapsed customers", "Subscribers"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Resolve a marketing audience label to a concrete User filter. */
async function audienceFilter(audience: string): Promise<Record<string, unknown>> {
  if (audience === "Subscribers") {
    return { role: "customer", activePlan: { $ne: null } };
  }
  if (audience === "Active customers") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const ids = await Booking.distinct("user", { createdAt: { $gte: cutoff } });
    return { role: "customer", _id: { $in: ids } };
  }
  if (audience === "Lapsed customers") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const everBooked = await Booking.distinct("user", {});
    const recent = new Set((await Booking.distinct("user", { createdAt: { $gte: cutoff } })).map(String));
    const lapsedIds = everBooked.filter((id) => !recent.has(String(id)));
    return { role: "customer", _id: { $in: lapsedIds } };
  }
  return { role: "customer" };
}

export async function audienceSizes() {
  const sizes: Record<string, number> = {};
  for (const audience of AUDIENCES) {
    sizes[audience] = await User.countDocuments(await audienceFilter(audience));
  }
  return sizes;
}

export async function listCampaigns() {
  return Campaign.find().sort({ createdAt: -1 }).limit(50);
}

export async function sendCampaign(input: { title: string; body: string; audience: string }) {
  const customers = await User.find(await audienceFilter(input.audience)).select("_id deviceTokens");
  let pushDelivered = 0;
  for (const c of customers) {
    await notifyUser(c.id, { type: "system", title: input.title, body: input.body });
    if (c.deviceTokens?.length) pushDelivered += 1;
  }
  return Campaign.create({
    ...input,
    sentCount: customers.length,
    pushDelivered,
    inAppOnly: customers.length - pushDelivered,
  });
}

/* ----------------------------- Customers ---------------------------------- */

function mapCustomerSummary(u: UserDoc, agg?: { totalBookings: number; totalSpend: number }) {
  return {
    id: String(u.id),
    name: u.name,
    phone: u.phone,
    email: u.email ?? "",
    status: u.status ?? "active",
    activePlan: u.activePlan ?? null,
    vehicleCount: u.vehicles?.length ?? 0,
    addressCount: u.addresses?.length ?? 0,
    joinedAt: u.get("createdAt") as Date,
    totalBookings: agg?.totalBookings ?? 0,
    totalSpend: agg?.totalSpend ?? 0,
  };
}

export async function listCustomers() {
  const customers = await User.find({ role: "customer" }).sort({ createdAt: -1 }).limit(500);
  const ids = customers.map((c) => c._id);
  const bookings = await Booking.find({ user: { $in: ids } }).select("user price status");

  const aggByUser = new Map<string, { totalBookings: number; totalSpend: number }>();
  for (const b of bookings) {
    const key = String(b.user);
    const entry = aggByUser.get(key) ?? { totalBookings: 0, totalSpend: 0 };
    entry.totalBookings += 1;
    if (b.status === "completed") entry.totalSpend += b.price;
    aggByUser.set(key, entry);
  }

  return customers.map((c) => mapCustomerSummary(c, aggByUser.get(String(c._id))));
}

export async function getCustomer(id: string) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw ApiError.notFound("Customer not found");
  const bookings = await Booking.find({ user: customer._id }).select("price status");
  const totalSpend = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);

  return {
    ...mapCustomerSummary(customer, { totalBookings: bookings.length, totalSpend }),
    vehicles: customer.vehicles,
    addresses: customer.addresses,
  };
}

export async function setCustomerStatus(id: string, status: "active" | "suspended") {
  const customer = await User.findOneAndUpdate({ _id: id, role: "customer" }, { status }, { new: true });
  if (!customer) throw ApiError.notFound("Customer not found");
  return mapCustomerSummary(customer);
}

export async function getCustomerActivity(id: string) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw ApiError.notFound("Customer not found");

  const bookings = await Booking.find({ user: customer._id })
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(100);
  const payments = await Payment.find({ user: customer._id }).sort({ createdAt: -1 }).limit(100);

  return {
    bookings: bookings.map(mapBooking),
    payments: payments.map((p) => mapPayment(p)),
  };
}

/* ------------------------------ Payments ----------------------------------- */

function mapPayment(p: PaymentDocument) {
  const user = p.user as unknown as { id?: string; name?: string } | null;
  const booking = p.booking as unknown as { id?: string; agentName?: string | null; society?: string } | null;
  return {
    id: p.id,
    customerId: (user && typeof user === "object" && user.id) || String(p.user),
    customerName: (user && typeof user === "object" && user.name) || "Customer",
    bookingId: (booking && typeof booking === "object" && booking.id) || (p.booking ? String(p.booking) : null),
    society: (booking && typeof booking === "object" && booking.society) || "",
    agentName: (booking && typeof booking === "object" && booking.agentName) || null,
    orderId: p.orderId,
    paymentId: p.paymentId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    refundAmount: p.refundAmount,
    refundedAt: p.refundedAt,
    refundReason: p.refundReason,
    agentPayout: p.agentPayout,
    settlementStatus: p.settlementStatus,
    settledAt: p.settledAt,
    createdAt: p.get("createdAt") as Date,
  };
}

export async function listPayments() {
  const payments = await Payment.find()
    .populate("user", "name")
    .populate("booking", "agentName society")
    .sort({ createdAt: -1 })
    .limit(200);
  return payments.map((p) => mapPayment(p));
}

export async function paymentStats() {
  const payments = await Payment.find();
  const totalCollected = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments
    .filter((p) => p.status === "refunded")
    .reduce((s, p) => s + p.refundAmount, 0);
  const pendingSettlement = payments
    .filter((p) => p.status === "paid" && p.settlementStatus === "pending")
    .reduce((s, p) => s + Math.round(p.amount * 0.7), 0);
  const settledAmount = payments
    .filter((p) => p.settlementStatus === "settled")
    .reduce((s, p) => s + p.agentPayout, 0);

  return { totalCollected, totalRefunded, pendingSettlement, settledAmount };
}

export async function refundPayment(id: string, input: { amount?: number; reason?: string }) {
  const payment = await Payment.findById(id).populate("user", "name").populate("booking", "agentName society");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status !== "paid") throw ApiError.badRequest("Only paid payments can be refunded");

  payment.status = "refunded";
  payment.refundAmount = input.amount ?? payment.amount;
  payment.refundedAt = new Date();
  payment.refundReason = input.reason ?? "";
  await payment.save();
  return mapPayment(payment);
}

export async function settlePayment(id: string) {
  const payment = await Payment.findById(id).populate("user", "name").populate("booking", "agentName society");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status !== "paid") throw ApiError.badRequest("Only paid payments can be settled");
  if (payment.settlementStatus === "settled") throw ApiError.badRequest("Payment is already settled");

  payment.agentPayout = Math.round(payment.amount * 0.7);
  payment.settlementStatus = "settled";
  payment.settledAt = new Date();
  await payment.save();
  return mapPayment(payment);
}

/** Daily revenue + booking count for the last `days` days (oldest first), zero-filled. */
async function revenueTrend(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await Booking.aggregate<{ _id: string; revenue: number; bookings: number }>([
    { $match: { status: "completed", date: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        revenue: { $sum: "$price" },
        bookings: { $sum: 1 },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));

  const series: { date: string; revenue: number; bookings: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    series.push({ date: key, revenue: row?.revenue ?? 0, bookings: row?.bookings ?? 0 });
  }
  return series;
}

async function revenueByVehicle() {
  const [rows, categories] = await Promise.all([
    Booking.aggregate<{ _id: string; revenue: number; count: number }>([
      { $match: { status: "completed" } },
      { $group: { _id: "$vehicleType", revenue: { $sum: "$price" }, count: { $sum: 1 } } },
    ]),
    listCategories(),
  ]);
  const byType = new Map(rows.map((r) => [r._id, r]));
  return categories.map((c) => ({
    vehicleType: c.key,
    revenue: byType.get(c.key)?.revenue ?? 0,
    count: byType.get(c.key)?.count ?? 0,
  }));
}

async function topSocieties() {
  const rows = await Booking.aggregate<{ _id: string; count: number }>([
    { $match: { society: { $nin: ["", null] } } },
    { $group: { _id: "$society", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);
  return rows.map((r) => ({ society: r._id, count: r.count }));
}

async function agentPerformance() {
  const perf = await Booking.aggregate<{
    _id: import("mongoose").Types.ObjectId;
    jobsCompleted: number;
    jobsCancelled: number;
    jobsTotal: number;
    revenue: number;
  }>([
    { $match: { assignedAgent: { $ne: null } } },
    {
      $group: {
        _id: "$assignedAgent",
        jobsCompleted: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        jobsCancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        jobsTotal: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$price", 0] } },
      },
    },
  ]);
  const byAgent = new Map(perf.map((r) => [String(r._id), r]));

  const agents = await User.find({ role: "agent" });
  return agents
    .map((a) => {
      const p = byAgent.get(a.id);
      const jobsTotal = p?.jobsTotal ?? 0;
      const jobsCompleted = p?.jobsCompleted ?? 0;
      return {
        id: a.id,
        name: a.name,
        rating: a.rating,
        revenue: p?.revenue ?? 0,
        jobsCompleted,
        jobsCancelled: p?.jobsCancelled ?? 0,
        completionRate: jobsTotal ? Math.round((jobsCompleted / jobsTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

async function customerRetention() {
  const totalCustomers = await User.countDocuments({ role: "customer" });

  const perCustomer = await Booking.aggregate<{ _id: import("mongoose").Types.ObjectId; count: number }>([
    { $match: { status: "completed" } },
    { $group: { _id: "$user", count: { $sum: 1 } } },
  ]);
  const customersWithBooking = perCustomer.length;
  const repeatCustomers = perCustomer.filter((c) => c.count > 1).length;
  const repeatRate = customersWithBooking ? Math.round((repeatCustomers / customersWithBooking) * 100) : 0;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const newThisMonth = await User.countDocuments({ role: "customer", createdAt: { $gte: startOfThisMonth } });
  const newLastMonth = await User.countDocuments({
    role: "customer",
    createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth },
  });

  return { totalCustomers, customersWithBooking, repeatCustomers, repeatRate, newThisMonth, newLastMonth };
}

export async function reports() {
  const [trend, byVehicle, societies, agentPerf, retention] = await Promise.all([
    revenueTrend(30),
    revenueByVehicle(),
    topSocieties(),
    agentPerformance(),
    customerRetention(),
  ]);
  return {
    revenueTrend: trend,
    revenueByVehicle: byVehicle,
    topSocieties: societies,
    agentPerformance: agentPerf,
    customerRetention: retention,
  };
}
