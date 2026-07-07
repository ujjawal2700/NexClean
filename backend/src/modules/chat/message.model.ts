import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const chatMessageSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderType: { type: String, enum: ["customer", "staff"], required: true },
    text: { type: String, required: true },
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

export type ChatMessageDocument = HydratedDocument<InferSchemaType<typeof chatMessageSchema>>;
export const ChatMessage = model("ChatMessage", chatMessageSchema);
