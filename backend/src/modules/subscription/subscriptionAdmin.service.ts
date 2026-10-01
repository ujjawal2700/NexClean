import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { Plan } from "../catalog/plan.model";
import { Payment } from "../payment/payment.model";

/**
 * Admin → Subscriptions: who is on a plan, and what plans have earned.
 *
 * Revenue counts only plan payments that actually completed ("paid"). Plan
 * purchases made before payments were tagged with kind "subscription" carry no
 * record of which plan they were for, so they can't be counted here; the
 * subscribers themselves still appear, with no amount paid against them.
 */
export async function subscriptionOverview() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [plans, subscribers, purchases] = await Promise.all([
    Plan.find().select("name washesPerMonth active").lean(),
    User.find({ role: "customer", activePlan: { $nin: [null, ""] } })
      .select("name phone activePlan subscriptionStartDate subscriptionEndDate")
      .sort({ subscriptionStartDate: -1 })
      .lean(),
    Payment.find({ kind: "subscription", status: { $in: ["paid", "refunded"] } })
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const planById = new Map(plans.map((p) => [String(p._id), p]));
  const paid = purchases.filter((p) => p.status === "paid");

  // Washes each subscriber has used in their current cycle, from one query.
  const cycles = new Map(subscribers.map((s) => [String(s._id), s]));
  const washes = subscribers.length
    ? await Booking.find({
        isSubscriptionWash: true,
        status: { $ne: "cancelled" },
        user: { $in: subscribers.map((s) => s._id) },
      })
        .select("user date")
        .lean()
    : [];
  const usedBy = new Map<string, number>();
  for (const w of washes) {
    const uid = String(w.user);
    const sub = cycles.get(uid);
    const start = sub?.subscriptionStartDate;
    const end = sub?.subscriptionEndDate;
    if (start && end && w.date >= start && w.date <= end) usedBy.set(uid, (usedBy.get(uid) ?? 0) + 1);
  }

  const paidBy = new Map<string, number>();
  for (const p of paid) {
    const uid = String((p.user as { _id?: unknown } | null)?._id ?? p.user);
    paidBy.set(uid, (paidBy.get(uid) ?? 0) + p.amount);
  }

  const isActive = (end?: Date | null) => !!end && end.getTime() > now.getTime();

  const subscriberRows = subscribers.map((s) => {
    const plan = planById.get(String(s.activePlan));
    return {
      id: String(s._id),
      name: s.name || "Customer",
      phone: s.phone ?? "",
      planId: String(s.activePlan),
      planName: plan?.name ?? String(s.activePlan),
      startDate: s.subscriptionStartDate ?? null,
      endDate: s.subscriptionEndDate ?? null,
      status: isActive(s.subscriptionEndDate) ? ("active" as const) : ("expired" as const),
      washesUsed: usedBy.get(String(s._id)) ?? 0,
      washesLimit: plan?.washesPerMonth ?? 0,
      totalPaid: paidBy.get(String(s._id)) ?? 0,
    };
  });

  const byPlan = plans.map((plan) => {
    const id = String(plan._id);
    const planPaid = paid.filter((p) => p.planId === id);
    return {
      planId: id,
      name: plan.name,
      active: plan.active !== false,
      activeSubscribers: subscriberRows.filter((s) => s.planId === id && s.status === "active").length,
      purchases: planPaid.length,
      revenue: planPaid.reduce((s, p) => s + p.amount, 0),
    };
  });

  return {
    stats: {
      activeSubscribers: subscriberRows.filter((s) => s.status === "active").length,
      expiredSubscribers: subscriberRows.filter((s) => s.status === "expired").length,
      totalRevenue: paid.reduce((s, p) => s + p.amount, 0),
      revenueThisMonth: paid
        .filter((p) => new Date(p.createdAt as unknown as Date) >= monthStart)
        .reduce((s, p) => s + p.amount, 0),
      purchases: paid.length,
    },
    byPlan,
    subscribers: subscriberRows,
    recentPurchases: purchases.slice(0, 50).map((p) => {
      const user = p.user as { name?: string; phone?: string } | null;
      return {
        id: String(p._id),
        customerName: user?.name || "Customer",
        planName: p.planName ?? p.planId ?? "—",
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt as unknown as Date,
      };
    }),
  };
}
