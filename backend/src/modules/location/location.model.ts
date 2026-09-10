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
  city: any;
  active: boolean;
  color?: string;
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  pincodes: string[];
}

const zoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: Schema.Types.ObjectId, ref: "City", required: true },
    active: { type: Boolean, default: true },
    color: { type: String, default: "#4F7CFF" },
    boundary: {
      type: polygonSchema,
      required: false,
      default: undefined,
    },
    pincodes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true, toJSON: jsonTransform },
);

zoneSchema.index({ boundary: "2dsphere" }, { sparse: true });

export type CityDoc = HydratedDocument<InferSchemaType<typeof citySchema>>;
export type ZoneDoc = HydratedDocument<IZone>;

export const City = model("City", citySchema);
export const ServiceZone = model<IZone>("ServiceZone", zoneSchema);
