import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * A customer's star rating and written review of the cleaner who did one
 * booking. One per booking — the cleaner's overall rating is the average of
 * these, so a second review of the same wash would count it twice.
 */
const reviewSchema = new Schema(
  {
    booking: { type: Types.ObjectId, ref: "Booking", required: true, unique: true },
    customer: { type: Types.ObjectId, ref: "User", required: true, index: true },
    agent: { type: Types.ObjectId, ref: "User", required: true },
    // Snapshotted so the review still reads right if a name changes later.
    agentName: { type: String, default: "" },
    customerName: { type: String, default: "" },
    packageName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true },
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

// A cleaner's reviews, newest first — the agent and admin review lists.
reviewSchema.index({ agent: 1, createdAt: -1 });

export type ReviewDoc = HydratedDocument<InferSchemaType<typeof reviewSchema>>;
export const Review = model("Review", reviewSchema);
