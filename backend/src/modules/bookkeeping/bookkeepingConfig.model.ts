import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Admin → Bookkeeping settings, one global document: GST, the business
 * details printed on invoices, invoice numbering, and the invoice template.
 */
const bookkeepingConfigSchema = new Schema(
  {
    _id: { type: String, default: "global" },

    tax: {
      // Off until an admin turns it on, so deploying this changes no prices.
      enabled: { type: Boolean, default: false },
      rate: { type: Number, default: 18, min: 0, max: 28 },
      label: { type: String, default: "GST", trim: true },
      // intra = CGST + SGST (customer in the business's state); inter = IGST.
      supplyType: { type: String, enum: ["intra", "inter"], default: "intra" },
      // Services Accounting Code printed on each invoice line.
      sacCode: { type: String, default: "998729", trim: true },
    },

    business: {
      legalName: { type: String, default: "NexClean", trim: true },
      tradeName: { type: String, default: "NexClean", trim: true },
      gstin: { type: String, default: "", trim: true, uppercase: true },
      pan: { type: String, default: "", trim: true, uppercase: true },
      addressLine: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      state: { type: String, default: "", trim: true },
      stateCode: { type: String, default: "", trim: true },
      pincode: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      website: { type: String, default: "", trim: true },
    },

    invoice: {
      // NXC/2026-27/00001
      prefix: { type: String, default: "NXC", trim: true },
      numberPadding: { type: Number, default: 5, min: 3, max: 8 },
    },

    template: {
      title: { type: String, default: "Tax Invoice", trim: true },
      accentColor: { type: String, default: "#0f766e", trim: true },
      showLogo: { type: Boolean, default: true },
      headerNote: { type: String, default: "", trim: true },
      footerNote: { type: String, default: "Thank you for choosing NexClean!", trim: true },
      terms: {
        type: String,
        default:
          "1. This is a computer-generated invoice and does not require a physical signature.\n2. Refunds for cancelled bookings are processed as per the NexClean refund policy.",
        trim: true,
      },
      signatoryLabel: { type: String, default: "Authorised Signatory", trim: true },
      showVehicleDetails: { type: Boolean, default: true },
      showServiceAddress: { type: Boolean, default: true },
      showCleaner: { type: Boolean, default: true },
      showPaymentInfo: { type: Boolean, default: true },
      showTaxBreakup: { type: Boolean, default: true },
      showAmountInWords: { type: Boolean, default: true },
      showSignature: { type: Boolean, default: true },
      labels: {
        billTo: { type: String, default: "Bill to", trim: true },
        serviceDetails: { type: String, default: "Service details", trim: true },
        description: { type: String, default: "Description", trim: true },
        amount: { type: String, default: "Amount", trim: true },
        subtotal: { type: String, default: "Subtotal", trim: true },
        taxable: { type: String, default: "Taxable value", trim: true },
        total: { type: String, default: "Total payable", trim: true },
      },
    },
  },
  { timestamps: true, minimize: false },
);

export type BookkeepingConfigDoc = HydratedDocument<InferSchemaType<typeof bookkeepingConfigSchema>>;
export const BookkeepingConfig = model("BookkeepingConfig", bookkeepingConfigSchema);

/** Invoice serial per financial year: { _id: "2026-27", seq: 41 }. */
const invoiceCounterSchema = new Schema({ _id: { type: String }, seq: { type: Number, default: 0 } }, { versionKey: false });
export const InvoiceCounter = model("InvoiceCounter", invoiceCounterSchema);
