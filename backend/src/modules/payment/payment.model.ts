import { Schema, model, Types } from "mongoose";

const paymentSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    booking: { type: Types.ObjectId, ref: "Booking" },
    orderId: { type: String, required: true },
    paymentId: { type: String, default: null },
    amount: { type: Number, required: true }, // in rupees
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "paid", "mock"], default: "created" },
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

export const Payment = model("Payment", paymentSchema);
