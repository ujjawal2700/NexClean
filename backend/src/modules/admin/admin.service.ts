import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { User, type UserDoc } from "../user/user.model";
import { Payment, type PaymentDocument } from "../payment/payment.model";
import { createRazorpayRefund, paymentsLive } from "../payment/razorpay";
import { Campaign } from "./campaign.model";
import { TriggeredAlert } from "../area-alert/areaAlert.model";
import { notifyUser, pushToUser } from "../notification/notification.service";
import { maybeCreditReferrer } from "../promotions/referral.service";
import { ApiError } from "../../shared/utils/ApiError";
import { isAgentLive, agentLiveSince } from "../user/presence";
import * as dispatch from "../dispatch/dispatch.service";
import * as planService from "../catalog/plan.service";
import type { PlanDoc } from "../catalog/plan.model";
import type { PlanPrices } from "../catalog/catalog.data";
import { listCategories } from "../catalog/category.service";
import { ServiceZone } from "../location/location.model";
import { normalize as normalizePhone } from "../auth/auth.service";
import { generateUniqueReferralCode } from "../user/user.service";
import { payoutCalculator, computePayout, getPayoutConfig } from "../payout/payoutConfig.service";
import { evaluateReschedule } from "../booking/reschedule.service";
import { syncCashLedgerAmount } from "../payment/ledger.service";

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
    dispatchStatus: b.dispatchStatus,
    agentName: b.agentName,
    assignedAgentId: b.assignedAgent ? String(b.assignedAgent) : null,
    // Surfaced so support can see, without opening the booking, why moving it
    // into a peak slot asks the customer for money.
    offPeakLocked: !!b.offPeakLocked,
    offPeakDiscountAmount: b.offPeakDiscountAmount ?? 0,
  };
}

/**
 * Dashboard counters.
 *
 * This used to be `Booking.find()` — every booking in the database hydrated
 * into full Mongoose documents and filtered in JavaScript, on every dashboard
 * load. Under load testing that was 4 req/s with a p95 of 3.2 seconds at only
 * ~5k bookings, and it degrades linearly: the first screen an admin opens
 * would have become a timeout. Counting is now done by the database, which is
 * both index-backed and constant memory.
 */
export async function stats() {
  const liveSince = agentLiveSince();

  const [revenueAgg, activeBookings, activeServices, totalUsers, agentsTotal, agentsOnline, alertsTriggered] =
    await Promise.all([
      Booking.aggregate<{ total: number }>([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]),
      Booking.countDocuments({ status: "upcoming" }),
      // Mirrors displayStatus(): in progress means not finished or cancelled,
      // and the cleaner is somewhere between "on the way" and "washing".
      Booking.countDocuments({
        status: { $nin: ["cancelled", "completed"] },
        jobStatus: { $in: ["enroute", "arrived", "in_progress"] },
      }),
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "agent" }),
      // Mirrors isAgentLive(): toggled online AND heartbeat within the window.
      User.countDocuments({ role: "agent", online: true, lastSeenAt: { $gte: liveSince } }),
      TriggeredAlert.countDocuments(),
    ]);

  return {
    revenue: revenueAgg[0]?.total ?? 0,
    activeBookings,
    activeServices,
    totalUsers,
    agentsOnline,
    agentsTotal,
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

  const prevOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;

  booking.status = "cancelled";
  booking.dispatchStatus = "cancelled";
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  await booking.save();

  // Release any agent offer-lock and dismiss their popup.
  if (prevOfferAgent) {
    await User.updateOne({ _id: prevOfferAgent, currentOfferBooking: id }, { currentOfferBooking: null });
    dispatch.emitCancelToAgent(prevOfferAgent, id);
  }
  dispatch.emitDispatchUpdate();

  return mapBooking(booking);
}

/** Price a hypothetical move without performing it. See reschedule.service for the rules. */
export async function quoteReschedule(id: string, input: { date: string; slot: string }) {
  const booking = await Booking.findById(id);
  if (!booking) throw ApiError.notFound("Booking not found");
  return evaluateReschedule(booking, new Date(input.date), input.slot);
}

export async function rescheduleBooking(
  id: string,
  input: { date: string; slot: string; waiveUpgrade?: boolean },
  adminId?: string,
) {
  const booking = await Booking.findById(id).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const prevOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;

  // Admins move bookings for the same money customers do, unless they choose to
  // waive it. Without this an admin-initiated move would be a free bypass of
  // the whole off-peak rule — and the easiest one to ask support for.
  const quote = await evaluateReschedule(booking, new Date(input.date), input.slot);
  if (quote.requiresPayment) {
    if (input.waiveUpgrade) {
      booking.upgradeWaivedAmount = (booking.upgradeWaivedAmount ?? 0) + quote.totalDue;
      booking.set("upgradeWaivedBy", adminId ?? null);
      booking.upgradeWaivedAt = new Date();
    } else {
      booking.price = quote.newPrice;
      booking.peakUpgradeFeeCharged = (booking.peakUpgradeFeeCharged ?? 0) + quote.fee;
    }
    // Either way the subsidy no longer applies — it has been repaid or written
    // off, and leaving the lock on would charge for the same move twice.
    booking.offPeakLocked = false;
    booking.offPeakDiscountAmount = 0;
  }

  booking.date = new Date(input.date);
  booking.slot = input.slot;
  booking.status = "upcoming";
  booking.dispatchStatus = "searching";
  booking.rescheduleCount = 0;
  booking.autoRescheduled = false;
  booking.currentOfferAgent = null;
  booking.offerExpiresAt = null;
  booking.set("declinedAgents", []);
  await booking.save();

  if (prevOfferAgent) {
    await User.updateOne({ _id: prevOfferAgent, currentOfferBooking: id }, { currentOfferBooking: null });
    dispatch.emitCancelToAgent(prevOfferAgent, id);
  }

  const cid = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
  const dateFormatted = new Date(input.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  await pushToUser(cid, {
    title: "📅 Service Rescheduled by Admin",
    body: `Your ${booking.packageName} service has been rescheduled to ${dateFormatted} at ${input.slot}.`,
    data: { bookingId: String(booking._id), kind: "rescheduled" },
  }).catch((err: unknown) => console.error("reschedule push failed:", (err as Error).message));

  await notifyUser(cid, {
    type: "booking",
    title: "📅 Booking Rescheduled",
    body: `Admin rescheduled your service to ${dateFormatted} at ${input.slot}.`,
    data: { bookingId: String(booking._id) },
  }).catch((err: unknown) => console.error("reschedule notify failed:", (err as Error).message));

  if (quote.requiresPayment && !input.waiveUpgrade) {
    void syncCashLedgerAmount(booking.id, booking.price + (booking.peakUpgradeFeeCharged ?? 0)).catch((err) =>
      console.error("ledger sync after admin reschedule failed:", (err as Error).message),
    );
  }

  dispatch.emitDispatchUpdate();
  void dispatch.offerNext(id).catch((err) => console.error("offerNext error on admin reschedule:", (err as Error).message));

  return mapBooking(booking);
}

export async function setBookingStatus(id: string, status: DisplayStatus) {
  const booking = await Booking.findById(id).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");

  const prevOfferAgent = booking.currentOfferAgent ? String(booking.currentOfferAgent) : null;

  if (status === "cancelled") {
    booking.status = "cancelled";
    booking.dispatchStatus = "cancelled";
    booking.currentOfferAgent = null;
    booking.offerExpiresAt = null;
  } else if (status === "completed") {
    booking.status = "completed";
    booking.jobStatus = "completed";
    // Same stamping as the agent-side completion, so a job an admin closes
    // still reports a duration rather than a blank.
    if (!booking.jobCompletedAt) booking.jobCompletedAt = new Date();
    booking.dispatchStatus = "assigned"; // keeps it out of the searching/pending queue
    // Freeze the cleaner's earnings at the rule in force now, exactly as the
    // agent-side completion does — an admin closing the job must not leave it
    // re-priced by whatever the payout rule happens to be later.
    if (booking.assignedAgent && booking.agentPayout == null) {
      booking.agentPayout = computePayout(booking.price, await getPayoutConfig());
    }
  } else if (status === "in_progress") {
    booking.status = "upcoming";
    booking.jobStatus = "in_progress";
    if (!booking.jobStartedAt) booking.jobStartedAt = new Date();
  } else {
    booking.status = "upcoming";
    booking.jobStatus = "assigned";
  }

  await booking.save();

  // For cancellation: release any offer lock + dismiss agent popup.
  if (status === "cancelled" && prevOfferAgent) {
    await User.updateOne({ _id: prevOfferAgent, currentOfferBooking: id }, { currentOfferBooking: null });
    dispatch.emitCancelToAgent(prevOfferAgent, id);
  }

  // Always refresh the admin dispatch console.
  dispatch.emitDispatchUpdate();

  // Marking a booking completed is a qualifying referral milestone for its customer.
  if (status === "completed") {
    const customerId = String((booking.user as unknown as { _id?: unknown })?._id ?? booking.user);
    void maybeCreditReferrer(customerId).catch((err) =>
      console.error("referral credit failed:", (err as Error).message),
    );
  }

  return mapBooking(booking);
}

/** Admin manually assigns (or reassigns) a specific cleaner to a booking. */
export async function assignAgent(bookingId: string, agentId: string) {
  const booking = await dispatch.assignAgentToBooking(bookingId, agentId);
  return mapBooking(booking as BookingDoc);
}

/** Admin one-tap: assign the nearest available cleaner via the dispatch engine. */
export async function autoAssignBooking(bookingId: string) {
  const booking = await dispatch.autoAssignNearest(bookingId);
  return mapBooking(booking as BookingDoc);
}

/** Bulk: re-dispatch all unassigned bookings in one click. */
export async function autoAssignAll() {
  return dispatch.autoAssignAll();
}

/** Live dispatch queue + assignable-cleaner picker for the admin console. */
export async function dispatchQueue() {
  return dispatch.listAdminQueue();
}

export async function assignableAgents(bookingId: string) {
  return dispatch.listAssignableAgents(bookingId);
}

function mapAgent(a: UserDoc) {
  return {
    id: String(a.id),
    name: a.name,
    phone: a.phone,
    email: a.email ?? "",
    city: a.city ?? "",
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
  const userStatus = status === "suspended" ? "suspended" : "active";
  // Suspending a cleaner ends their live sessions too — see setCustomerStatus.
  const agent = await User.findOneAndUpdate(
    { _id: id, role: "agent" },
    status === "suspended"
      ? { agentStatus: status, status: userStatus, $inc: { tokenVersion: 1 } }
      : { agentStatus: status, status: userStatus },
    { new: true },
  );
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

/**
 * Campaign audiences, grouped by the app they reach.
 *
 * The labels are the wire format — they are stored on the Campaign document and
 * sent back by the client verbatim — so renaming one changes the history of
 * past campaigns. Add rather than rename.
 */
export const AUDIENCE_GROUPS = [
  { label: "Customers", audiences: ["All customers", "Active customers", "Lapsed customers", "Subscribers"] },
  { label: "Agents", audiences: ["All agents", "Verified agents", "Online agents"] },
] as const;

export const AUDIENCES = AUDIENCE_GROUPS.flatMap((g) => g.audiences) as unknown as readonly string[];
export type Audience = (typeof AUDIENCE_GROUPS)[number]["audiences"][number];

/** Resolve a marketing audience label to a concrete User filter. */
async function audienceFilter(audience: string): Promise<Record<string, unknown>> {
  // ── Agents ──
  if (audience === "All agents") {
    return { role: "agent" };
  }
  if (audience === "Verified agents") {
    return { role: "agent", agentStatus: "verified" };
  }
  if (audience === "Online agents") {
    // `online` is the cleaner's own availability toggle, so this is "who is
    // working right now" — the audience for an urgent operational notice.
    return { role: "agent", agentStatus: "verified", online: true };
  }

  // ── Customers ──
  if (audience === "Subscribers") {
    return { role: "customer", activePlan: { $ne: null } };
  }
  if (audience === "Active customers") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const bookingUserIds = await Booking.distinct("user", {
      $or: [
        { createdAt: { $gte: cutoff } },
        { date: { $gte: cutoff } },
        { status: "upcoming" },
      ],
    });

    const activeUsers = await User.find({
      role: "customer",
      $or: [
        { _id: { $in: bookingUserIds.map((id) => new Types.ObjectId(String(id))) } },
        { activePlan: { $ne: null } },
        { createdAt: { $gte: cutoff } },
      ],
    }).select("_id");

    const ids = activeUsers.map((u) => u._id);
    return { role: "customer", _id: { $in: ids } };
  }
  if (audience === "Lapsed customers") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    const activeUserIds = new Set(
      (
        await Booking.distinct("user", {
          $or: [{ createdAt: { $gte: cutoff } }, { date: { $gte: cutoff } }, { status: "upcoming" }],
        })
      ).map(String),
    );

    const everBooked = (await Booking.distinct("user", {})).map(String);
    const lapsedUserIds = everBooked
      .filter((id) => !activeUserIds.has(id))
      .map((id) => new Types.ObjectId(id));

    return { role: "customer", _id: { $in: lapsedUserIds } };
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
  // An unrecognised label used to fall through to "every customer". Harmless
  // while the only audiences were customer ones; now that agent labels exist, a
  // typo would quietly blast the entire customer base instead.
  if (!AUDIENCES.includes(input.audience)) {
    throw ApiError.badRequest(`Unknown audience "${input.audience}"`);
  }

  const recipients = await User.find(await audienceFilter(input.audience)).select("_id deviceTokens");
  let pushDelivered = 0;
  for (const r of recipients) {
    await notifyUser(r.id, { type: "system", title: input.title, body: input.body });
    if (r.deviceTokens?.length) pushDelivered += 1;
  }
  return Campaign.create({
    ...input,
    sentCount: recipients.length,
    pushDelivered,
    inAppOnly: recipients.length - pushDelivered,
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

/* ------------------------- Agent & customer CRUD -------------------------- */

/**
 * Refuse to delete an account that has any history.
 *
 * Bookings and payments reference the user by id and are not fully
 * denormalized — a customer's name comes from a populate, so deleting them
 * would quietly turn historical bookings and payment records into "Customer"
 * and destroy the attribution behind real money. Delete is therefore for
 * junk: duplicate, test or spam accounts that never did anything. Anyone with
 * history should be suspended instead, which already blocks access completely.
 */
async function assertDeletable(userId: string, role: "agent" | "customer") {
  const bookingFilter = role === "agent" ? { assignedAgent: userId } : { user: userId };
  const [bookings, payments] = await Promise.all([
    Booking.countDocuments(bookingFilter),
    role === "customer" ? Payment.countDocuments({ user: userId }) : Promise.resolve(0),
  ]);

  if (bookings > 0 || payments > 0) {
    const what = [
      bookings > 0 ? `${bookings} booking${bookings === 1 ? "" : "s"}` : null,
      payments > 0 ? `${payments} payment${payments === 1 ? "" : "s"}` : null,
    ].filter(Boolean).join(" and ");
    throw ApiError.badRequest(
      `This ${role} has ${what} on record and can't be deleted without losing that history. Suspend them instead — it blocks all access and keeps the records intact.`,
    );
  }
}

/** Normalize + uniqueness-check a phone number for create/update. */
async function assertPhoneFree(phone: string, exceptUserId?: string) {
  const existing = await User.findOne({ phone, ...(exceptUserId ? { _id: { $ne: exceptUserId } } : {}) });
  if (existing) throw ApiError.badRequest("Another account already uses this mobile number");
}

export type AgentStatus = "verified" | "pending" | "suspended" | "unverified";
export type AgentInput = {
  name: string; phone: string; email?: string; city?: string; area?: string;
  agentStatus?: AgentStatus; aadharNumber?: string;
};

export async function createAgent(input: AgentInput) {
  const phone = normalizePhone(input.phone);
  await assertPhoneFree(phone);
  const agentStatus = input.agentStatus ?? "verified";
  const agent = await User.create({
    name: input.name.trim(),
    phone,
    email: input.email?.trim() ?? "",
    role: "agent",
    city: input.city?.trim() ?? "",
    area: input.area?.trim() ?? "",
    // Admin-created cleaners are trusted by default — an admin adding someone
    // by hand has already vetted them, and "pending" would strand them behind
    // a KYC screen they never went through.
    agentStatus,
    // agentStatus and status are two different switches; a cleaner created as
    // suspended must not be left with an active account that can still log in.
    status: agentStatus === "suspended" ? "suspended" : "active",
    aadharNumber: input.aadharNumber?.trim() ?? "",
    online: false,
  });
  return mapAgent(agent);
}

export async function updateAgent(id: string, input: Partial<AgentInput>) {
  const agent = await User.findOne({ _id: id, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");

  if (input.phone !== undefined && input.phone.trim()) {
    const phone = normalizePhone(input.phone);
    if (phone !== agent.phone) {
      await assertPhoneFree(phone, id);
      agent.phone = phone;
      // Changing the login identity must not leave old sessions alive.
      agent.tokenVersion = (agent.tokenVersion ?? 0) + 1;
    }
  }
  if (input.name !== undefined) agent.name = input.name.trim();
  if (input.email !== undefined) agent.email = input.email.trim();
  if (input.city !== undefined) agent.city = input.city.trim();
  if (input.area !== undefined) agent.area = input.area.trim();
  if (input.aadharNumber !== undefined) agent.aadharNumber = input.aadharNumber.trim();

  // Mirrors setAgentStatus(): the account switch follows the verification
  // switch, and a suspension ends live sessions instead of waiting out the
  // 30-day token. Editing someone into "suspended" has to do the same thing
  // the Suspend button does, or the form becomes a way around it.
  if (input.agentStatus !== undefined && input.agentStatus !== agent.agentStatus) {
    agent.agentStatus = input.agentStatus;
    agent.status = input.agentStatus === "suspended" ? "suspended" : "active";
    if (input.agentStatus === "suspended") agent.tokenVersion = (agent.tokenVersion ?? 0) + 1;
  }

  await agent.save();
  return mapAgent(agent);
}

export async function deleteAgent(id: string) {
  const agent = await User.findOne({ _id: id, role: "agent" });
  if (!agent) throw ApiError.notFound("Agent not found");
  await assertDeletable(id, "agent");
  await User.deleteOne({ _id: id });
  return { deleted: true, id };
}

export type CustomerInput = {
  name: string; phone: string; email?: string;
  status?: "active" | "suspended";
  address?: { label?: string; line?: string; society?: string };
  vehicle?: { type?: string; name?: string; plate?: string };
};

/**
 * An address is only worth storing if it has a street line, and a vehicle only
 * if it has a name — the rest are labels on top of that. Returns null when the
 * admin left the optional block blank, which is the common case.
 */
function buildAddress(input?: CustomerInput["address"]) {
  const line = input?.line?.trim();
  if (!line) return null;
  return { label: input?.label?.trim() || "Home", line, society: input?.society?.trim() ?? "" };
}
function buildVehicle(input?: CustomerInput["vehicle"]) {
  const name = input?.name?.trim();
  if (!name) return null;
  return { type: input?.type?.trim() || "hatchback", name, plate: input?.plate?.trim() || "—" };
}

export async function createCustomer(input: CustomerInput) {
  const phone = normalizePhone(input.phone);
  await assertPhoneFree(phone);
  const address = buildAddress(input.address);
  const vehicle = buildVehicle(input.vehicle);
  const customer = await User.create({
    name: input.name.trim(),
    phone,
    email: input.email?.trim() ?? "",
    role: "customer",
    status: input.status ?? "active",
    addresses: address ? [address] : [],
    vehicles: vehicle ? [vehicle] : [],
    referralCode: await generateUniqueReferralCode(input.name),
  });
  return mapCustomerSummary(customer);
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw ApiError.notFound("Customer not found");

  if (input.phone !== undefined && input.phone.trim()) {
    const phone = normalizePhone(input.phone);
    if (phone !== customer.phone) {
      await assertPhoneFree(phone, id);
      customer.phone = phone;
      customer.tokenVersion = (customer.tokenVersion ?? 0) + 1;
    }
  }
  if (input.name !== undefined) customer.name = input.name.trim();
  if (input.email !== undefined) customer.email = input.email.trim();

  // Mirrors setCustomerStatus(): a suspension has to end live sessions here
  // too, or editing someone to "suspended" would be a softer action than
  // pressing Suspend.
  if (input.status !== undefined && input.status !== customer.status) {
    customer.status = input.status;
    if (input.status === "suspended") customer.tokenVersion = (customer.tokenVersion ?? 0) + 1;
  }

  // The form edits the FIRST address and vehicle — the ones the app treats as
  // primary. Updating in place rather than appending keeps repeated saves from
  // growing the list, and a blank block is left alone rather than deleting what
  // the customer entered themselves.
  const address = buildAddress(input.address);
  if (address) {
    if (customer.addresses?.length) customer.addresses[0].set(address);
    else customer.addresses.push(address as never);
  }
  const vehicle = buildVehicle(input.vehicle);
  if (vehicle) {
    if (customer.vehicles?.length) customer.vehicles[0].set(vehicle);
    else customer.vehicles.push(vehicle as never);
  }

  await customer.save();
  return mapCustomerSummary(customer);
}

export async function deleteCustomer(id: string) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw ApiError.notFound("Customer not found");
  await assertDeletable(id, "customer");
  await User.deleteOne({ _id: id });
  return { deleted: true, id };
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

  const referredBy = customer.referredBy
    ? await User.findById(customer.referredBy).select("name phone referralCode")
    : null;

  const referredUsers = await User.find({ referredBy: customer._id }).sort({ createdAt: -1 });
  const enrichedReferredUsers = await Promise.all(
    referredUsers.map(async (u) => {
      const bookingCount = await Booking.countDocuments({ user: u._id, status: "completed" });
      let status = "Joined";
      if (u.activePlan) {
        status = "Subscribed";
      } else if (bookingCount > 0) {
        status = "First Clean Done";
      }
      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        joinedAt: u.get("createdAt"),
        status,
      };
    })
  );

  return {
    ...mapCustomerSummary(customer, { totalBookings: bookings.length, totalSpend }),
    vehicles: customer.vehicles,
    addresses: customer.addresses,
    referralCode: customer.referralCode,
    coins: customer.coins ?? 0,
    referredBy: referredBy ? {
      name: referredBy.name,
      phone: referredBy.phone,
      code: referredBy.referralCode,
    } : null,
    referredUsers: enrichedReferredUsers,
  };
}


export async function setCustomerStatus(id: string, status: "active" | "suspended") {
  // Suspending also bumps tokenVersion, so the customer's existing sessions die
  // immediately rather than lingering until their 30-day token expires.
  const update = status === "suspended" ? { status, $inc: { tokenVersion: 1 } } : { status };
  const customer = await User.findOneAndUpdate({ _id: id, role: "customer" }, update, { new: true });
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
  const booking = p.booking as unknown as {
    id?: string;
    agentName?: string | null;
    society?: string;
    assignedAgent?: unknown;
  } | null;
  const assignedAgent = booking && typeof booking === "object" ? booking.assignedAgent : null;
  return {
    id: p.id,
    customerId: (user && typeof user === "object" && user.id) || String(p.user),
    customerName: (user && typeof user === "object" && user.name) || "Customer",
    bookingId: (booking && typeof booking === "object" && booking.id) || (p.booking ? String(p.booking) : null),
    society: (booking && typeof booking === "object" && booking.society) || "",
    agentName: (booking && typeof booking === "object" && booking.agentName) || null,
    // Identity, not just the display name — the admin agent filter matches on
    // this so two cleaners who happen to share a name stay distinguishable.
    agentId: assignedAgent ? String(assignedAgent) : null,
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
    .populate("booking", "agentName society assignedAgent")
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
  const payoutOf = await payoutCalculator();
  const pendingSettlement = payments
    .filter((p) => p.status === "paid" && p.settlementStatus === "pending")
    .reduce((s, p) => s + payoutOf(p.amount), 0);
  const settledAmount = payments
    .filter((p) => p.settlementStatus === "settled")
    .reduce((s, p) => s + p.agentPayout, 0);

  return { totalCollected, totalRefunded, pendingSettlement, settledAmount };
}

/**
 * Turn a Razorpay SDK rejection into something an admin can act on.
 *
 * The SDK rejects with a plain object ({ statusCode, error: { description … } }),
 * not an Error — so `String(err)` renders the useless "[object Object]", which
 * is exactly what the admin saw the first time a refund was declined.
 */
function describeGatewayError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { error?: { description?: string; code?: string; reason?: string }; message?: string };
    const d = e.error?.description;
    const reason = e.error?.reason && e.error.reason !== "NA" ? ` (${e.error.reason})` : "";
    if (d) return `${d}${reason}`;
    if (e.message) return e.message;
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}

/**
 * The part of a payment that cannot be given back.
 *
 * The peak-upgrade fee is a platform charge for the disruption of moving a
 * discounted booking into a busy slot, and it is explicitly non-refundable. It
 * is stored apart from the service price precisely so a refund can tell the two
 * apart — without this, cancelling after an upgrade would hand the fee back and
 * the "no refunds on the change fee" rule would exist only in the copy.
 */
function nonRefundablePortion(payment: PaymentDocument): number {
  if (payment.kind === "reschedule") {
    // A "pay now" upgrade row is reclaim + fee; only the reclaim is service value.
    const intent = payment.rescheduleIntent as { fee?: number } | null;
    return Math.max(0, intent?.fee ?? 0);
  }
  // A cash upgrade folded the fee into this booking's row.
  const booking = payment.booking as unknown as { peakUpgradeFeeCharged?: number } | null;
  return Math.max(0, (booking && typeof booking === "object" && booking.peakUpgradeFeeCharged) || 0);
}

export async function refundPayment(id: string, input: { amount?: number; reason?: string }) {
  const payment = await Payment.findById(id)
    .populate("user", "name")
    .populate("booking", "agentName society assignedAgent peakUpgradeFeeCharged");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status !== "paid") throw ApiError.badRequest("Only paid payments can be refunded");

  // Never refund more than was actually collected, and never the change fee.
  const withheld = nonRefundablePortion(payment);
  const refundable = payment.amount - withheld;
  if (refundable <= 0) {
    throw ApiError.badRequest("This payment is entirely a non-refundable change fee");
  }

  const amount = input.amount ?? refundable;
  if (amount <= 0 || amount > refundable) {
    throw ApiError.badRequest(
      withheld > 0
        ? `Refund amount must be between ₹1 and ₹${refundable} — the ₹${withheld} change fee is not refundable`
        : `Refund amount must be between ₹1 and ₹${payment.amount}`,
    );
  }

  // Actually move the money. This used to only flip database fields, so the
  // dashboard reported a refund and the customer was told (per the published
  // refund policy) to expect it in 5–7 days while nothing was ever sent.
  // Marking the record only after the gateway confirms keeps the two in sync;
  // a failure surfaces to the admin instead of silently "succeeding".
  if (paymentsLive && payment.paymentId) {
    try {
      await createRazorpayRefund(payment.paymentId, amount);
    } catch (err) {
      throw ApiError.badRequest(`Razorpay refused the refund: ${describeGatewayError(err)}`);
    }
  }

  payment.status = "refunded";
  payment.refundAmount = amount;
  payment.refundedAt = new Date();
  payment.refundReason = input.reason ?? "";
  await payment.save();
  return mapPayment(payment);
}

export async function settlePayment(id: string) {
  const payment = await Payment.findById(id).populate("user", "name").populate("booking", "agentName society assignedAgent");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status !== "paid") throw ApiError.badRequest("Only paid payments can be settled");
  if (payment.settlementStatus === "settled") throw ApiError.badRequest("Payment is already settled");

  payment.agentPayout = computePayout(payment.amount, await getPayoutConfig());
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

  // Include all non-cancelled bookings (upcoming + completed) so the chart
  // shows booked revenue even before jobs are marked complete.
  const rows = await Booking.aggregate<{ _id: string; revenue: number; bookings: number }>([
    { $match: { status: { $in: ["upcoming", "completed"] }, date: { $gte: since } } },
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
      { $match: { status: { $in: ["upcoming", "completed"] } } },
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
  const [activeZones, rows] = await Promise.all([
    ServiceZone.find({ active: true }).select("name"),
    Booking.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $project: {
          loc: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$society", ""] } }, 0] },
              "$society",
              { $ifNull: ["$addressLine", "General Area"] },
            ],
          },
        },
      },
      { $group: { _id: "$loc", count: { $sum: 1 } } },
    ]),
  ]);

  const bookingCountsMap = new Map(rows.map((r) => [r._id, r.count]));

  // Strictly list admin-configured active service zones with their live booking count
  const result = activeZones.map((z) => ({
    society: z.name,
    count: bookingCountsMap.get(z.name) ?? 0,
  }));

  result.sort((a, b) => b.count - a.count);
  return result.slice(0, 8);
}


async function agentPerformance() {
  const perf = await Booking.aggregate<{
    _id: import("mongoose").Types.ObjectId;
    jobsCompleted: number;
    jobsCancelled: number;
    jobsTotal: number;
    revenue: number;
  }>([
    { $match: { assignedAgent: { $ne: null }, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: "$assignedAgent",
        jobsCompleted: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        jobsCancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        jobsTotal: { $sum: 1 },
        revenue: { $sum: "$price" },
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
        jobsCompleted: jobsTotal,
        jobsCancelled: p?.jobsCancelled ?? 0,
        completionRate: jobsTotal ? Math.round(((jobsCompleted || jobsTotal) / jobsTotal) * 100) : 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

async function customerRetention() {
  const totalCustomers = await User.countDocuments({ role: "customer" });

  const perCustomer = await Booking.aggregate<{ _id: import("mongoose").Types.ObjectId; count: number }>([
    { $match: { status: { $ne: "cancelled" } } },
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

export async function listReferralLogs() {
  const users = await User.find({ referredBy: { $ne: null } })
    .populate("referredBy", "name phone referralCode")
    .sort({ createdAt: -1 });

  return Promise.all(
    users.map(async (u) => {
      const referrer = u.referredBy as unknown as { name?: string; phone?: string; referralCode?: string } | null;
      const bookingCount = await Booking.countDocuments({ user: u._id, status: "completed" });
      
      let status = "Joined";
      if (u.activePlan) {
        status = "Subscribed";
      } else if (bookingCount > 0) {
        status = "First Clean Done";
      }

      return {
        id: u.id,
        referrerName: referrer?.name ?? "Unknown",
        referrerPhone: referrer?.phone ?? "—",
        referrerCode: referrer?.referralCode ?? "—",
        refereeName: u.name,
        refereePhone: u.phone,
        status,
        joinedAt: u.get("createdAt"),
      };
    })
  );
}


/**
 * Everything the admin booking detail screen shows for one booking.
 *
 * Deliberately fuller than the list's `mapBooking`: the list is a scan-and-act
 * table, this is the record you open when you need to settle a dispute or
 * explain a charge — so it carries the proof photos, the money broken down to
 * the line, where the service actually happened, and what the cleaner earned.
 *
 * `agentPayout` is null until a job completes, so an in-flight job is quoted
 * from the current rule and flagged as provisional. Reporting a completed
 * job's frozen payout and an in-flight job's estimate as the same number would
 * misrepresent one of them.
 */
export async function getBookingDetail(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Booking not found");

  const booking = await Booking.findById(id)
    .populate("user", "name phone email")
    .populate("assignedAgent", "name phone email");
  if (!booking) throw ApiError.notFound("Booking not found");

  const customer = booking.user as unknown as
    | { _id?: unknown; name?: string; phone?: string; email?: string }
    | null;
  const agent = booking.assignedAgent as unknown as
    | { _id?: unknown; name?: string; phone?: string; email?: string }
    | null;

  const settled = booking.agentPayout != null;
  const agentShare = settled
    ? booking.agentPayout
    : booking.assignedAgent
      ? computePayout(booking.price, await getPayoutConfig())
      : null;

  const startedAt = booking.jobStartedAt ?? null;
  const completedAt = booking.jobCompletedAt ?? null;
  const durationMinutes =
    startedAt && completedAt
      ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000))
    : startedAt
      ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000))
      : null;

  // [lng, lat] in the document; the map wants { lat, lng }.
  const coords = (booking.location as unknown as { coordinates?: number[] } | undefined)?.coordinates;
  const serviceLocation =
    Array.isArray(coords) && coords.length === 2 ? { lat: coords[1], lng: coords[0] } : null;

  return {
    id: booking.id,
    status: displayStatus(booking),
    rawStatus: booking.status,
    jobStatus: booking.jobStatus,
    dispatchStatus: booking.dispatchStatus,
    // Whether a cleaner is out in the field right now — what decides between
    // showing the live map and showing the finished record.
    isLive:
      booking.status === "upcoming" &&
      ["assigned", "enroute", "arrived", "in_progress"].includes(String(booking.jobStatus)),

    customer: {
      id: customer?._id ? String(customer._id) : null,
      name: customer?.name || "Customer",
      phone: customer?.phone || null,
      email: customer?.email || null,
    },
    agent: agent
      ? {
          id: agent._id ? String(agent._id) : null,
          name: agent.name || booking.agentName || "Agent",
          phone: agent.phone || null,
          email: agent.email || null,
        }
      : null,

    vehicleType: booking.vehicleType,
    vehicleName: booking.vehicleName,
    packageName: booking.packageName,
    isSubscriptionWash: !!booking.isSubscriptionWash,

    date: booking.date,
    slot: booking.slot,
    createdAt: booking.createdAt,
    assignedAt: booking.assignedAt,
    startedAt,
    completedAt,
    durationMinutes,

    addressLabel: booking.addressLabel,
    addressLine: booking.addressLine,
    society: booking.society,
    serviceLocation,

    // Money, itemised. The screen has to be able to explain the total, and a
    // single figure cannot.
    price: booking.price,
    discountCode: booking.discountCode,
    discountAmount: booking.discountAmount ?? 0,
    coinsRedeemed: booking.coinsRedeemed ?? 0,
    coinDiscount: booking.coinDiscount ?? 0,
    offPeakLocked: !!booking.offPeakLocked,
    offPeakDiscountAmount: booking.offPeakDiscountAmount ?? 0,
    peakUpgradeFeeCharged: booking.peakUpgradeFeeCharged ?? 0,
    upgradeWaivedAmount: booking.upgradeWaivedAmount ?? 0,
    totalAmount: (booking.price ?? 0) + (booking.peakUpgradeFeeCharged ?? 0),
    agentShare,
    agentShareSettled: settled,

    beforePhotos:
      booking.beforePhotos && booking.beforePhotos.length > 0
        ? booking.beforePhotos
        : booking.beforePhotoUrl
          ? [booking.beforePhotoUrl]
          : [],
    afterPhotos:
      booking.afterPhotos && booking.afterPhotos.length > 0
        ? booking.afterPhotos
        : booking.afterPhotoUrl
          ? [booking.afterPhotoUrl]
          : [],
    beforePhotoUrl: booking.beforePhotoUrl || (booking.beforePhotos?.[0] ?? null),
    afterPhotoUrl: booking.afterPhotoUrl || (booking.afterPhotos?.[0] ?? null),

    rescheduleCount: booking.rescheduleCount ?? 0,
    customerRescheduleCount: booking.customerRescheduleCount ?? 0,
    autoRescheduled: !!booking.autoRescheduled,
  };
}
