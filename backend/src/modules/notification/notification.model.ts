import { Schema, model, Types } from "mongoose";

const notificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["booking", "area_alert", "system"], default: "system" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Object, default: {} },
    read: { type: Boolean, default: false },
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

export const Notification = model("Notification", notificationSchema);
