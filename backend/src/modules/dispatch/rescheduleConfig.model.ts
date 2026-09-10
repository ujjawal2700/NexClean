import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Single global configuration for the automatic missed-slot sweep.
 *
 * This used to be two module-level `let` variables. The admin API happily wrote
 * to them and read them back, so the change looked like it had stuck — but the
 * values were gone on the next restart or deploy, silently reverting to 30 and
 * 2 with nothing in any log to say so. Persisting it fixes that; the shape is
 * unchanged so the existing endpoints keep working.
 */
const rescheduleConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    /** Grace period after a slot ends before the sweep treats the job as missed. */
    bufferMinutes: { type: Number, required: true, min: 0, default: 30 },
    /** How many times the sweep may push one booking before handing it to admins. */
    maxDaysLimit: { type: Number, required: true, min: 1, default: 2 },
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

export type RescheduleConfigDoc = HydratedDocument<InferSchemaType<typeof rescheduleConfigSchema>>;
export const RescheduleConfig = model("RescheduleConfig", rescheduleConfigSchema);
