import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/** Bounds on the admin-set offer timeout. Below 10s nobody can read the popup; above 10 min the job stalls. */
export const MIN_OFFER_TIMEOUT_SECONDS = 10;
export const MAX_OFFER_TIMEOUT_SECONDS = 600;

/**
 * Admin-editable dispatch tunables, one global document. Persisted (rather than
 * env-only) so the ops team can change the offer window from the admin panel
 * without a redeploy — and so the change survives restarts, unlike the
 * module-level variables rescheduleConfig.model replaced.
 */
const dispatchConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    /** How long one cleaner has to accept a job offer before it moves to the next. */
    offerTimeoutSeconds: {
      type: Number,
      required: true,
      min: MIN_OFFER_TIMEOUT_SECONDS,
      max: MAX_OFFER_TIMEOUT_SECONDS,
    },
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

export type DispatchConfigDoc = HydratedDocument<InferSchemaType<typeof dispatchConfigSchema>>;
export const DispatchConfig = model("DispatchConfig", dispatchConfigSchema);
