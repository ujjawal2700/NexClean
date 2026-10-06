/**
 * GST maths for the checkout preview — a mirror of backend
 * src/modules/bookkeeping/tax.ts. The server recomputes and is authoritative
 * (an order is refused if the quoted total no longer matches), but the two
 * must stay identical or customers would see a total that then "changes".
 */
export type TaxSettings = {
  enabled: boolean;
  rate: number;
  label: string;
  supplyType: "intra" | "inter";
};

export type TaxBreakdown = {
  taxRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  roundOff: number;
  payableAmount: number;
};

const paise = (n: number) => Math.round(n * 100) / 100;

export function computeTax(taxable: number, settings: TaxSettings | null | undefined): TaxBreakdown {
  const base = paise(Math.max(0, taxable));
  if (!settings?.enabled || !(settings.rate > 0) || base === 0) {
    return {
      taxRate: settings?.enabled && base === 0 ? settings.rate : 0,
      taxableAmount: base,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
      roundOff: 0,
      payableAmount: base,
    };
  }
  const rate = settings.rate;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (settings.supplyType === "inter") {
    igst = paise((base * rate) / 100);
  } else {
    cgst = paise((base * rate) / 200);
    sgst = cgst;
  }
  const taxAmount = paise(cgst + sgst + igst);
  const exact = paise(base + taxAmount);
  const payableAmount = Math.round(exact);
  return {
    taxRate: rate,
    taxableAmount: base,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    taxAmount,
    roundOff: paise(payableAmount - exact),
    payableAmount,
  };
}

/** What the customer owes on a booking — mirrors backend bookingAmountDue. */
export function bookingAmountDue(b: {
  price: number;
  taxableAmount?: number | null;
  payableAmount?: number | null;
  peakUpgradeFeeCharged?: number | null;
}): number {
  const checkout = b.payableAmount ?? b.price;
  const reclaimed = b.taxableAmount != null ? Math.max(0, b.price - b.taxableAmount) : 0;
  return paise(checkout + reclaimed + (b.peakUpgradeFeeCharged ?? 0));
}

/** ₹1,234.50 — always two decimals, for tax lines where paise matter. */
export function formatMoneyExact(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** 1234.5 → "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only" (Indian lakh/crore grouping). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paiseN = Math.round((Math.abs(amount) - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.length ? parts.join(" ") : "Zero";
  return `Rupees ${words}${paiseN ? ` and ${belowHundred(paiseN)} Paise` : ""} Only`;
}
