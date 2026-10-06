import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from "mongoose";

const lineSchema = new Schema(
  {
    description: { type: String, required: true },
    sac: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    // Signed: discounts are negative lines.
    amount: { type: Number, required: true },
    // "service" and "discount" lines are taxable; "adjustment" lines (charged
    // after checkout, e.g. a peak-upgrade fee on reschedule) are not.
    kind: { type: String, enum: ["service", "discount", "adjustment"], default: "service" },
  },
  { _id: false },
);

/**
 * One invoice per booking. Money figures are snapshotted when it's issued (and
 * refreshed if the booking's charges change), and so are the seller details
 * printed on it — a later change of address or GSTIN must not rewrite old
 * invoices. Layout comes from the current template at render time.
 */
const invoiceSchema = new Schema(
  {
    booking: { type: Types.ObjectId, ref: "Booking", required: true, unique: true },
    customer: { type: Types.ObjectId, ref: "User", required: true, index: true },
    // Set a moment after the record is created, by the one request that created
    // it (see ensureInvoiceForBooking) — that's what keeps the series gap-free.
    invoiceNumber: { type: String, default: null },
    financialYear: { type: String, default: "" },
    // Set if a request had to finish numbering for one that died mid-way.
    numberRecoveredAt: { type: Date, default: null },
    issuedAt: { type: Date, default: () => new Date() },

    // issued → paid (online payment or cash collected) | cancelled (booking cancelled)
    status: { type: String, enum: ["issued", "paid", "cancelled"], default: "issued", index: true },

    billTo: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },
    seller: { type: Schema.Types.Mixed, default: {} },

    service: {
      packageName: { type: String, default: "" },
      vehicleName: { type: String, default: "" },
      vehicleType: { type: String, default: "" },
      vehiclePlate: { type: String, default: "" },
      date: { type: Date, default: null },
      slot: { type: String, default: "" },
      address: { type: String, default: "" },
      cleanerName: { type: String, default: "" },
      isSubscriptionWash: { type: Boolean, default: false },
    },

    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxLabel: { type: String, default: "GST" },
    taxRate: { type: Number, default: 0 },
    supplyType: { type: String, enum: ["intra", "inter"], default: "intra" },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    adjustmentTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "" },

    notes: { type: String, default: "" },
    // Admin edits: who last changed it and how many times.
    revision: { type: Number, default: 0 },
    editedAt: { type: Date, default: null },
    editedBy: { type: String, default: "" },
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

invoiceSchema.index({ issuedAt: -1 });
// Unique once assigned; a record awaiting its number (null) doesn't collide.
invoiceSchema.index(
  { invoiceNumber: 1 },
  { name: "invoiceNumber_unique", unique: true, partialFilterExpression: { invoiceNumber: { $type: "string" } } },
);

export type InvoiceDoc = HydratedDocument<InferSchemaType<typeof invoiceSchema>>;
export const Invoice = model("Invoice", invoiceSchema);
