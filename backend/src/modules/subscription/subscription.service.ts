import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { Plan } from "../catalog/plan.model";
import { agentLiveSince } from "../user/presence";
import { ApiError } from "../../shared/utils/ApiError";
import { isValidActivePlan } from "../catalog/plan.service";

const PLAN_PACKAGE_MAP: Record<string, { id: string; name: string }> = {
  basic: { id: "express", name: "Express Wash" },
  premium: { id: "premium", name: "Premium Detail" },
  elite: { id: "ultimate", name: "Ultimate Detail" },
};

export async function isPlanId(value: string): Promise<boolean> {
  return isValidActivePlan(value);
}

export async function subscribe(userId: string, planId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.activePlan = planId;
  user.subscriptionStartDate = new Date();
  user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();
  return user;
}

export async function unsubscribe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.activePlan = null;
  await user.save();
  return user;
}

export async function getSubscriptionSchedule(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.activePlan) {
    return { activePlan: null, subscriptionStartDate: null, subscriptionEndDate: null, bookings: [] };
  }

  const plan = await Plan.findById(user.activePlan);
  const bookings = await Booking.find({
    user: userId,
    isSubscriptionWash: true,
    status: { $ne: "cancelled" },
    date: {
      $gte: user.subscriptionStartDate,
      $lte: user.subscriptionEndDate,
    },
  }).sort({ date: 1 });

  return {
    activePlan: plan,
    subscriptionStartDate: user.subscriptionStartDate,
    subscriptionEndDate: user.subscriptionEndDate,
    bookings,
  };
}

export async function scheduleSubscriptionWash(
  userId: string,
  input: { vehicleId: string; addressId: string; date: string; slot: string },
) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.activePlan) throw ApiError.badRequest("You do not have an active subscription plan");

  const plan = await Plan.findById(user.activePlan);
  if (!plan) throw ApiError.badRequest("Active subscription plan details not found");

  const vehicle = user.vehicles.find((v) => String(v._id) === input.vehicleId);
  if (!vehicle) throw ApiError.notFound("Vehicle not found");

  const address = user.addresses.find((a) => String(a._id) === input.addressId);
  if (!address) throw ApiError.notFound("Address not found");

  // Validate package matching user's subscription tier
  const pkg = PLAN_PACKAGE_MAP[plan.id];
  if (!pkg) throw ApiError.badRequest("Package mapping not found for subscription");

  // Check wash limit for the current cycle
  const used = await Booking.countDocuments({
    user: userId,
    isSubscriptionWash: true,
    status: { $ne: "cancelled" },
    date: {
      $gte: user.subscriptionStartDate,
      $lte: user.subscriptionEndDate,
    },
  });

  if (plan.washesPerMonth !== -1 && used >= plan.washesPerMonth) {
    throw ApiError.badRequest(`Wash limit reached for the current cycle (${plan.washesPerMonth} washes max)`);
  }

  // Derive the society from address
  const society = address.society || address.line;

  // Auto-assign agent
  const liveFilter = { role: "agent", agentStatus: "verified", online: true, lastSeenAt: { $gte: agentLiveSince() } };
  const agent =
    (await User.findOne({ ...liveFilter, area: society })) ?? (await User.findOne(liveFilter));

  const booking = await Booking.create({
    user: userId,
    vehicleType: vehicle.type,
    vehicleName: vehicle.name,
    packageId: pkg.id,
    packageName: pkg.name,
    date: new Date(input.date),
    slot: input.slot,
    addressLabel: address.label,
    addressLine: address.line,
    society,
    price: 0,
    isSubscriptionWash: true,
    status: "upcoming",
    assignedAgent: agent?.id ?? null,
    agentName: agent?.name ?? null,
    jobStatus: "assigned",
  });

  return booking;
}

export async function rescheduleSubscriptionWash(
  userId: string,
  bookingId: string,
  input: { date: string; slot: string },
) {
  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw ApiError.notFound("Booking not found");
  if (!booking.isSubscriptionWash) throw ApiError.badRequest("This booking is not part of a subscription");
  if (booking.status !== "upcoming") throw ApiError.badRequest("Only upcoming washes can be rescheduled");

  // Validate 12-hour constraint
  const diffMs = new Date(booking.date).getTime() - Date.now();
  if (diffMs < 12 * 60 * 60 * 1000) {
    throw ApiError.badRequest("Subscription washes can only be rescheduled at least 12 hours in advance");
  }

  booking.date = new Date(input.date);
  booking.slot = input.slot;
  await booking.save();
  return booking;
}
