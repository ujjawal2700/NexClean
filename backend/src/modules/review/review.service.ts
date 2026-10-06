import { Types } from "mongoose";
import { Review } from "./review.model";
import { Booking } from "../booking/booking.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { notifyUser } from "../notification/notification.service";
import { logBookingEvent } from "../booking/bookingEvent.service";

export const MAX_REVIEW_LENGTH = 500;

export type ReviewView = {
  id: string;
  bookingId: string;
  agentId: string;
  agentName: string;
  customerName: string;
  packageName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type ReviewLike = {
  _id: unknown;
  booking: unknown;
  agent: unknown;
  agentName?: string | null;
  customerName?: string | null;
  packageName?: string | null;
  rating: number;
  comment?: string | null;
  createdAt?: Date | string | null;
};

export function toReviewView(r: ReviewLike): ReviewView {
  return {
    id: String(r._id),
    bookingId: String(r.booking),
    agentId: String(r.agent),
    agentName: r.agentName ?? "",
    customerName: r.customerName ?? "",
    packageName: r.packageName ?? "",
    rating: r.rating,
    comment: r.comment ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
  };
}

/** "Priya Sharma" → "Priya S." — what a cleaner sees about who reviewed them. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Recompute a cleaner's overall rating from every review they've had. Done
 * from the source rows rather than a running average so it can never drift.
 */
export async function recomputeAgentRating(agentId: string | Types.ObjectId): Promise<{ rating: number; ratingCount: number }> {
  const [agg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { agent: new Types.ObjectId(String(agentId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const rating = agg ? Math.round(agg.avg * 100) / 100 : 0;
  const ratingCount = agg?.count ?? 0;
  await User.updateOne({ _id: agentId }, { $set: { rating, ratingCount } });
  return { rating, ratingCount };
}

/** The review on one booking, or null. */
export async function getReviewForBooking(bookingId: string): Promise<ReviewView | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;
  const r = await Review.findOne({ booking: bookingId }).lean();
  return r ? toReviewView(r) : null;
}

/** Reviews keyed by booking id, for decorating lists of bookings. */
export async function reviewsByBooking(bookingIds: unknown[]): Promise<Map<string, ReviewView>> {
  if (bookingIds.length === 0) return new Map();
  const rows = await Review.find({ booking: { $in: bookingIds } }).lean();
  return new Map(rows.map((r) => [String(r.booking), toReviewView(r)]));
}

/**
 * A customer rates the cleaner who did one of their completed bookings.
 * One review per booking; it can't be edited afterwards, so a cleaner's
 * rating can't be talked up or down after the fact.
 */
export async function submitReview(
  customerId: string,
  bookingId: string,
  input: { rating: number; comment?: string },
): Promise<ReviewView> {
  if (!Types.ObjectId.isValid(bookingId)) throw ApiError.notFound("Booking not found");
  const booking = await Booking.findOne({ _id: bookingId, user: customerId }).populate("user", "name");
  if (!booking) throw ApiError.notFound("Booking not found");
  if (booking.status !== "completed") throw ApiError.badRequest("You can rate a service once it's completed.");
  if (!booking.assignedAgent) throw ApiError.badRequest("This booking has no cleaner to rate.");
  if (await Review.exists({ booking: booking._id })) {
    throw ApiError.conflict("You've already rated this service.");
  }

  const customerName = (booking.user as unknown as { name?: string } | null)?.name ?? "";
  let review;
  try {
    review = await Review.create({
      booking: booking._id,
      customer: customerId,
      agent: booking.assignedAgent,
      agentName: booking.agentName ?? "",
      customerName,
      packageName: booking.packageName,
      rating: input.rating,
      comment: (input.comment ?? "").trim().slice(0, MAX_REVIEW_LENGTH),
    });
  } catch (err) {
    // Two taps racing past the exists() check above — the unique index wins.
    if ((err as { code?: number }).code === 11000) throw ApiError.conflict("You've already rated this service.");
    throw err;
  }

  const agentId = String(booking.assignedAgent);
  const { rating: overall } = await recomputeAgentRating(agentId);

  logBookingEvent(booking._id, {
    type: "reviewed",
    agentId,
    agentName: booking.agentName,
    actor: "customer",
    actorName: customerName,
    reason: review.comment,
    meta: { rating: review.rating },
  });

  const stars = "⭐".repeat(review.rating);
  void notifyUser(agentId, {
    type: "booking",
    title: `${stars} New ${review.rating}-star review`,
    body: review.comment
      ? `${shortName(customerName)}: “${review.comment.slice(0, 120)}” · Your rating is now ${overall.toFixed(1)}`
      : `${shortName(customerName)} rated your ${booking.packageName}. Your rating is now ${overall.toFixed(1)}`,
    data: { role: "agent", url: "/agent/reviews", bookingId },
  }).catch((err) => console.error("review notification failed:", (err as Error).message));

  return toReviewView(review);
}

export type AgentReviewSummary = {
  rating: number;
  ratingCount: number;
  /** How many reviews gave each star count, 1–5. */
  breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  reviews: ReviewView[];
};

/**
 * A cleaner's rating, star breakdown and reviews, newest first. The cleaner's
 * own view gets customers' short names only; the admin view gets full names.
 */
export async function getAgentReviews(
  agentId: string,
  opts: { limit?: number; forAgent?: boolean } = {},
): Promise<AgentReviewSummary> {
  if (!Types.ObjectId.isValid(agentId)) throw ApiError.notFound("Agent not found");
  const agent = new Types.ObjectId(agentId);
  const [rows, groups, user] = await Promise.all([
    Review.find({ agent }).sort({ createdAt: -1 }).limit(opts.limit ?? 100).lean(),
    Review.aggregate<{ _id: number; n: number }>([{ $match: { agent } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    User.findById(agentId).select("rating ratingCount").lean(),
  ]);
  const breakdown = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  groups.forEach((g) => {
    const key = String(g._id) as keyof typeof breakdown;
    if (key in breakdown) breakdown[key] = g.n;
  });
  const ratingCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const total = Object.entries(breakdown).reduce((s, [k, n]) => s + Number(k) * n, 0);
  return {
    // With reviews, the true average; without, whatever the profile carries (seeded / set by an admin).
    rating: ratingCount ? Math.round((total / ratingCount) * 100) / 100 : (user?.rating ?? 0),
    ratingCount,
    breakdown,
    reviews: rows.map((r) => {
      const view = toReviewView(r);
      return opts.forAgent ? { ...view, customerName: shortName(view.customerName) } : view;
    }),
  };
}
