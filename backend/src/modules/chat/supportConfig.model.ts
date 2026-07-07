import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const supportConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },
    manualSupportStatus: { type: String, enum: ["auto", "online", "offline"], default: "auto" },
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

export type SupportConfigDocument = HydratedDocument<InferSchemaType<typeof supportConfigSchema>>;
export const SupportConfig = model("SupportConfig", supportConfigSchema);
