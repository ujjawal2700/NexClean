import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const slotConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    slots: { type: [String], required: true },
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

export interface ISlotConfig {
  _id: string;
  slots: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export const SlotConfig = model("SlotConfig", slotConfigSchema);
