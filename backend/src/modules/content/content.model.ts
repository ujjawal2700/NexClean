import { Schema, model } from "mongoose";

/**
 * Singleton site-content config, editable by admins and consumed by the public
 * landing site. Each section is stored as a flexible object; the shape is defined
 * by SiteContent in content.defaults.ts and validated at the controller.
 */
const contentSchema = new Schema(
  {
    footer: { type: Object, required: true },
    pages: { type: Object, required: true },
    contact: { type: Object, required: true },
    help: { type: Object, required: true },
    landing: { type: Object, required: true },
  },
  {
    timestamps: true,
    minimize: false,
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

export const SiteContentModel = model("SiteContent", contentSchema);
