import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const internalMessageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "InternalConversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
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

internalMessageSchema.index({ conversation: 1, createdAt: 1 });

export type InternalMessageDocument = HydratedDocument<InferSchemaType<typeof internalMessageSchema>>;
export const InternalMessage = model("InternalMessage", internalMessageSchema);
