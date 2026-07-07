import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const supportTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    subject: { type: String, default: "Live Chat Support" },
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

export type SupportTicketDocument = HydratedDocument<InferSchemaType<typeof supportTicketSchema>>;
export const SupportTicket = model("SupportTicket", supportTicketSchema);
