import { Schema, model } from "mongoose";

const baseJson = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

/** Singleton config document for the Smart Area Alert feature. */
const settingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    radiusKm: { type: Number, default: 2 },
    windowMinutes: { type: Number, default: 30 },
    title: { type: String, default: "🚗 NexClean Nearby" },
    body: {
      type: String,
      default:
        "A cleaning specialist is servicing vehicles in {{society}}. Book within {{minutes}} minutes for priority service.",
    },
  },
  { timestamps: true, toJSON: baseJson },
);

const triggeredSchema = new Schema(
  {
    society: { type: String, required: true },
    agentName: { type: String, default: "NexClean Specialist" },
    sentCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: baseJson },
);

export const AreaAlertSettings = model("AreaAlertSettings", settingsSchema);
export const TriggeredAlert = model("TriggeredAlert", triggeredSchema);
