import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * The admin-managed list of bookable time slots, one global document. Stored
 * as "hh:mm AM/PM" strings, normalized and in chronological order — the same
 * shape bookings carry in their `slot` field.
 */
const slotConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    slots: { type: [String], required: true },
    // Minimum minutes between now and a slot's start for it to be bookable today.
    leadMinutes: { type: Number, min: 0 },
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

export type SlotConfigDoc = HydratedDocument<InferSchemaType<typeof slotConfigSchema>>;
export const SlotConfig = model("SlotConfig", slotConfigSchema);
