/**
 * Where a notification's "data" payload should take the viewer.
 *
 * The backend attaches an explicit `url` to every booking-flow push it sends
 * (assignment, on-the-way/arrived/started/completed, reminders). This is only
 * a fallback for the handful of older/agent-side events that still send just
 * a `bookingId` — kept here (rather than trusting every call site to add
 * `url`) so a deep link never silently regresses to "open the app" if one is
 * missed.
 *
 * Mirrored (not imported — it runs outside the bundler) in
 * public/firebase-messaging-sw.js. Keep the two in sync.
 */
export function resolveNotificationPath(data?: Record<string, string> | null): string | null {
  if (!data) return null;
  if (data.url) return data.url;
  if (data.bookingId) {
    return data.role === "agent" ? `/agent/jobs/${data.bookingId}` : `/app/track/${data.bookingId}`;
  }
  return null;
}
