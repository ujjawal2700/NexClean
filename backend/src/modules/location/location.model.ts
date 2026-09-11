import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const jsonTransform = {
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

const citySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: jsonTransform },
);

const polygonSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon"],
      required: true,
      default: "Polygon",
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
    },
  },
  { _id: false },
);

export interface IZone {
  name: string;
  // Optional: zones are standalone geofences, not a City's child. A city link
  // is only kept for the customer/agent signup "pick your society" pickers
  // (catalog.controller's /zones?cityId=), which predate real geofencing and
  // still query zones by city for the ones an admin has chosen to link.
  city?: any;
  active: boolean;
  color?: string;
  // Required: a zone with no drawn polygon isn't a geofence and can't be
  // dispatched through — see dispatch.query.ts's buildDispatchTiers.
  boundary: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

const zoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: Schema.Types.ObjectId, ref: "City", default: null },
    active: { type: Boolean, default: true },
    color: { type: String, default: "#4F7CFF" },
    boundary: {
      type: polygonSchema,
      required: true,
    },
  },
  { timestamps: true, toJSON: jsonTransform },
);

zoneSchema.index({ boundary: "2dsphere" });

export type CityDoc = HydratedDocument<InferSchemaType<typeof citySchema>>;
export type ZoneDoc = HydratedDocument<IZone>;

export const City = model("City", citySchema);
export const ServiceZone = model<IZone>("ServiceZone", zoneSchema);
