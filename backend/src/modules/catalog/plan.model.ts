import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/** Plan id is a human slug (e.g. "basic"), not an ObjectId — matches User.activePlan values. */
const planSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    washesPerMonth: { type: Number, required: true },
    active: { type: Boolean, default: true },
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

export type PlanDoc = HydratedDocument<InferSchemaType<typeof planSchema>>;
export const Plan = model("Plan", planSchema);
