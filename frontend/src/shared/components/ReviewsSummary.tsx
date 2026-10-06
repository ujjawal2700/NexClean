import type { ReactNode } from "react";
import { MessageSquareQuote } from "lucide-react";
import { StarDisplay, RATING_LABELS } from "@shared/ui/StarRating";
import { formatDate } from "@shared/lib/format";

export type ReviewItem = {
  id: string;
  bookingId: string;
  customerName: string;
  packageName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ReviewSummaryData = {
  rating: number;
  ratingCount: number;
  breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  reviews: ReviewItem[];
};

/**
 * A cleaner's overall rating, how many reviews gave each star count, and the
 * reviews themselves. Shared by the cleaner's "My reviews" page and the admin
 * cleaner profile; `bookingLink` lets the admin view link each review to its
 * booking.
 */
export function ReviewsSummary({
  data,
  bookingLink,
  emptyText = "No reviews yet.",
}: {
  data: ReviewSummaryData;
  bookingLink?: (bookingId: string, children: ReactNode) => ReactNode;
  emptyText?: string;
}) {
  const max = Math.max(1, ...Object.values(data.breakdown));
  return (
    <div className="space-y-5" data-testid="reviews-summary">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:pr-6">
          <p className="font-display text-5xl font-semibold text-ink" data-testid="reviews-average">
            {data.ratingCount ? data.rating.toFixed(1) : "—"}
          </p>
          <StarDisplay value={data.ratingCount ? data.rating : 0} size="size-5" className="mt-1" />
          <p className="mt-1 text-sm text-muted" data-testid="reviews-count">
            {data.ratingCount} review{data.ratingCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="space-y-1.5">
          {(["5", "4", "3", "2", "1"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0 text-muted">{k} star</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${(data.breakdown[k] / max) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-medium text-ink">{data.breakdown[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {data.reviews.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
          <MessageSquareQuote className="size-4" /> {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {data.reviews.map((r) => {
            const meta = (
              <span className="text-xs text-muted">
                {r.packageName} · #{r.bookingId.slice(-6).toUpperCase()}
              </span>
            );
            return (
              <li key={r.id} className="py-4" data-testid="review-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StarDisplay value={r.rating} />
                    <span className="text-sm font-medium text-ink">{RATING_LABELS[r.rating]}</span>
                  </div>
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment ? (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-ink-soft">“{r.comment}”</p>
                ) : (
                  <p className="mt-1.5 text-sm italic text-muted">No written review</p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span className="font-medium text-ink-soft">{r.customerName || "Customer"}</span>
                  {bookingLink ? bookingLink(r.bookingId, meta) : meta}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
