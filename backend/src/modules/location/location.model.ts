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

const zoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: Schema.Types.ObjectId, ref: "City", required: true },
    active: { type: Boolean, default: true },
    color: { type: String, default: "#4F7CFF" },
    boundary: {
      type: {
        type: String,
        enum: ["Polygon"],
        default: "Polygon",
      },
      coordinates: {
        type: Schema.Types.Mixed,
        default: undefined,
      },
    },
    pincodes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true, toJSON: jsonTransform },
);

zoneSchema.index({ boundary: "2dsphere" });

export type CityDoc = HydratedDocument<InferSchemaType<typeof citySchema>>;
export type ZoneDoc = HydratedDocument<InferSchemaType<typeof zoneSchema>>;

export const City = model("City", citySchema);
export const ServiceZone = model("ServiceZone", zoneSchema);
