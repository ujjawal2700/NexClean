import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Everything that happened to a booking, in order — the admin booking-detail
 * timeline. Append-only and kept in its own collection rather than as an array
 * on the booking: the dispatch engine updates bookings with compare-and-swap
 * filters, and an ever-growing embedded log would bloat every one of those
 * reads and writes.
 */
export const BOOKING_EVENT_TYPES = [
  "created", // customer booked (or a subscription wash was scheduled)
  "searching", // dispatch started looking for a cleaner
  "offered", // offer sent to one cleaner
  "declined", // that cleaner tapped decline
  "offer_expired", // that cleaner didn't answer in time
  "accepted", // that cleaner accepted the offer
  "claimed", // a cleaner picked it from the open-jobs pool
  "assigned", // an admin assigned a cleaner by hand
  "auto_assigned", // the system assigned the nearest cleaner (admin auto-assign / subscription scheduler)
  "admin_queue", // no cleaner found — waiting for an admin
  "released", // an assigned cleaner gave the job back ("can't go"), with a reason
  "enroute",
  "arrived",
  "started",
  "completed",
  "rescheduled",
  "cancelled",
  "reviewed", // the customer rated the cleaner
] as const;

export type BookingEventType = (typeof BOOKING_EVENT_TYPES)[number];

const bookingEventSchema = new Schema(
  {
    booking: { type: Types.ObjectId, ref: "Booking", required: true },
    type: { type: String, enum: BOOKING_EVENT_TYPES, required: true },
    at: { type: Date, default: () => new Date() },
    // The cleaner the event is about (offered to, declined, accepted, released…).
    agent: { type: Types.ObjectId, ref: "User", default: null },
    agentName: { type: String, default: "" },
    // Who caused it.
    actor: { type: String, enum: ["customer", "agent", "admin", "system"], default: "system" },
    actorName: { type: String, default: "" },
    // Free-text reason — the cleaner's "can't go" explanation, a cancellation reason.
    reason: { type: String, default: "" },
    // Small structured extras: distance of an offer, old/new slot of a reschedule.
    meta: { type: Schema.Types.Mixed, default: undefined },
  },
  { versionKey: false },
);

bookingEventSchema.index({ booking: 1, at: 1 });

export type BookingEventDoc = HydratedDocument<InferSchemaType<typeof bookingEventSchema>>;
export const BookingEvent = model("BookingEvent", bookingEventSchema);
