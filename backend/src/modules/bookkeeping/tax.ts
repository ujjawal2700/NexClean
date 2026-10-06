/**
 * GST maths — the one place it's done. Checkout preview, order creation,
 * booking creation and invoices all call this, so the amount quoted, the
 * amount charged and the amount on the invoice can never disagree.
 *
 * Prices are GST-exclusive: tax is added on top of the (post-discount)
 * service price. Tax heads are computed to the paisa, and the payable total
 * is rounded to the nearest rupee with the difference shown as "Round off" —
 * the usual Indian tax-invoice convention, and it keeps every amount a
 * gateway is asked to charge a whole number of rupees.
 *
 * frontend/src/shared/lib/tax.ts mirrors this for the checkout preview; keep
 * the two identical.
 */
export type TaxSettings = {
  enabled: boolean;
  /** Percent, e.g. 18. */
  rate: number;
  /** "intra": split into CGST + SGST (same state). "inter": IGST. */
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
  /** What the customer pays: taxable + tax + round off. */
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
    // Each half computed on its own rate so the two heads match a GST portal's figures.
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
