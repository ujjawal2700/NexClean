/** Invoice shapes shared by the customer and admin apps (backend: modules/bookkeeping). */

export type InvoiceTemplate = {
  title: string;
  accentColor: string;
  showLogo: boolean;
  headerNote: string;
  footerNote: string;
  terms: string;
  signatoryLabel: string;
  showVehicleDetails: boolean;
  showServiceAddress: boolean;
  showCleaner: boolean;
  showPaymentInfo: boolean;
  showTaxBreakup: boolean;
  showAmountInWords: boolean;
  showSignature: boolean;
  labels: {
    billTo: string;
    serviceDetails: string;
    description: string;
    amount: string;
    subtotal: string;
    taxable: string;
    total: string;
  };
};

export type InvoiceSeller = {
  legalName?: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
};

export type InvoiceLine = {
  description: string;
  sac: string;
  quantity: number;
  amount: number;
  kind: "service" | "discount" | "adjustment";
};

export type InvoiceStatus = "issued" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  booking: string;
  invoiceNumber: string;
  financialYear: string;
  issuedAt: string;
  status: InvoiceStatus;
  billTo: { name: string; phone: string; email: string; address: string; gstin: string };
  seller: InvoiceSeller;
  service: {
    packageName: string;
    vehicleName: string;
    vehicleType: string;
    vehiclePlate: string;
    date: string | null;
    slot: string;
    address: string;
    cleanerName: string;
    isSubscriptionWash: boolean;
  };
  lines: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxLabel: string;
  taxRate: number;
  supplyType: "intra" | "inter";
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  adjustmentTotal: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  notes: string;
  revision: number;
  editedAt: string | null;
  editedBy: string;
};

export type InvoiceWithTemplate = { invoice: Invoice; template: InvoiceTemplate };

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  issued: "Unpaid",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** "Shop 4, MG Road, Indore, Madhya Pradesh 452001" */
export function sellerAddress(s: InvoiceSeller): string {
  const tail = [s.city, [s.state, s.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [s.addressLine, tail].filter(Boolean).join(", ");
}

export function invoiceFileName(inv: Pick<Invoice, "invoiceNumber">): string {
  return `invoice-${inv.invoiceNumber.replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`;
}
