/** Shared date/money/time formatting helpers used across modules. */

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value: number | null | undefined): string {
  return `₹${(value ?? 0).toLocaleString("en-IN")}`;
}

/**
 * Sparse x-axis label for a day in a revenue/trend bar chart: only the first,
 * last, and every `everyNth` bar get a label, so a 30-day chart doesn't
 * collide into unreadable text. Shared by every screen that charts
 * `revenueTrend` (Reports, Payments) so the two read the same way.
 */
export function chartDayLabel(iso: string, everyNth: number, index: number, total: number): string {
  if (index !== 0 && index !== total - 1 && index % everyNth !== 0) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Trim a Mongo ObjectId down to a readable tail, e.g. "…a1b2c3d4".
 *
 * A full 24-character id crowds the line it sits on and nobody reads it end to
 * end — the last 8 characters are plenty to tell two records apart by eye or to
 * match one against a support ticket. The full value stays available via the
 * element's `title`, so it can still be read or copied when it's actually
 * needed. Kept here rather than inlined as `.slice(-8)` so every screen shortens
 * ids the same way.
 */
export function shortId(id: string | null | undefined, tail = 8): string {
  if (!id) return "—";
  return id.length <= tail ? id : `…${id.slice(-tail)}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
