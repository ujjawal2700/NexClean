import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { VEHICLE_TYPES } from "./catalog.data";

/** A plan's price for each vehicle type (the customer is charged based on their vehicle). */
const pricesSchema = new Schema(
  Object.fromEntries(VEHICLE_TYPES.map((v) => [v, { type: Number, required: true }])),
  { _id: false },
);

/** Plan id is a human slug (e.g. "basic"), not an ObjectId — matches User.activePlan values. */
const planSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    prices: { type: pricesSchema, required: true },
    washesPerMonth: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        // `price` = the cheapest vehicle price, used for "from ₹X" displays & MRR estimates.
        const prices = (ret.prices ?? {}) as Record<string, number>;
        const values = Object.values(prices).filter((n): n is number => typeof n === "number");
        ret.price = values.length ? Math.min(...values) : 0;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type PlanDoc = HydratedDocument<InferSchemaType<typeof planSchema>>;
export const Plan = model("Plan", planSchema);
