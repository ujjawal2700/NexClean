import { BookkeepingConfig } from "./bookkeepingConfig.model";
import type { TaxSettings } from "./tax";

type Plain = Record<string, unknown>;

export type BookkeepingConfigView = {
  tax: { enabled: boolean; rate: number; label: string; supplyType: "intra" | "inter"; sacCode: string };
  business: Record<
    "legalName" | "tradeName" | "gstin" | "pan" | "addressLine" | "city" | "state" | "stateCode" | "pincode" | "email" | "phone" | "website",
    string
  >;
  invoice: { prefix: string; numberPadding: number };
  template: InvoiceTemplate;
};

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
  labels: Record<"billTo" | "serviceDetails" | "description" | "amount" | "subtotal" | "taxable" | "total", string>;
};

async function loadDoc() {
  const existing = await BookkeepingConfig.findById("global");
  if (existing) return existing;
  try {
    return await BookkeepingConfig.create({ _id: "global" });
  } catch {
    // Two first requests racing to create it — read the winner's.
    return (await BookkeepingConfig.findById("global"))!;
  }
}

function view(doc: Awaited<ReturnType<typeof loadDoc>>): BookkeepingConfigView {
  const o = doc.toObject() as Plain;
  return { tax: o.tax, business: o.business, invoice: o.invoice, template: o.template } as BookkeepingConfigView;
}

export async function getBookkeepingConfig(): Promise<BookkeepingConfigView> {
  return view(await loadDoc());
}

/** The GST settings checkout applies. */
export async function getTaxSettings(): Promise<TaxSettings & { label: string; sacCode: string }> {
  const { tax } = await getBookkeepingConfig();
  return { enabled: tax.enabled, rate: tax.rate, supplyType: tax.supplyType, label: tax.label, sacCode: tax.sacCode };
}

/** Flattens { tax: { rate: 18 } } into { "tax.rate": 18 } so a patch only touches what it names. */
function flatten(obj: Plain, prefix = "", out: Plain = {}): Plain {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v as Plain, key, out);
    else out[key] = v;
  }
  return out;
}

export async function updateBookkeepingConfig(patch: Partial<Record<keyof BookkeepingConfigView, Plain>>) {
  await loadDoc();
  const set = flatten(patch as Plain);
  if (Object.keys(set).length > 0) {
    await BookkeepingConfig.updateOne({ _id: "global" }, { $set: set }, { runValidators: true });
  }
  return getBookkeepingConfig();
}

/** Restores the invoice template to its defaults (tax and business details untouched). */
export async function resetInvoiceTemplate() {
  await loadDoc();
  const defaults = new BookkeepingConfig().toObject() as Plain;
  await BookkeepingConfig.updateOne({ _id: "global" }, { $set: { template: defaults.template } });
  return getBookkeepingConfig();
}
