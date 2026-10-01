import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

const readStateSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const internalConversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
      validate: {
        validator: (value: unknown[]) => value.length === 2,
        message: "An internal conversation must have exactly two participants",
      },
    },
    participantKey: { type: String, required: true, unique: true, index: true },
    readStates: { type: [readStateSchema], default: [] },
    lastMessagePreview: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.participantKey;
        return ret;
      },
    },
  },
);

internalConversationSchema.index({ participants: 1, lastMessageAt: -1 });

export type InternalConversationDocument = HydratedDocument<InferSchemaType<typeof internalConversationSchema>>;
export const InternalConversation = model("InternalConversation", internalConversationSchema);
