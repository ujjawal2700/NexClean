import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/** What a conversation is about — picked by the customer/cleaner before chatting. */
export const SUPPORT_TOPICS = ["booking", "payment", "account", "app", "other"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

const supportTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    subject: { type: String, default: "Live Chat Support" },
    topic: { type: String, enum: SUPPORT_TOPICS, default: "other" },
    // The job this conversation is about, when it's about one — support sees
    // which booking without having to ask.
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    // Who last wrote. An open conversation whose last word was the customer's
    // (or cleaner's) is waiting on support — that drives the admin badge.
    lastSenderType: { type: String, enum: ["customer", "staff", null], default: null },
    lastMessageAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type SupportTicketDocument = HydratedDocument<InferSchemaType<typeof supportTicketSchema>>;
export const SupportTicket = model("SupportTicket", supportTicketSchema);
