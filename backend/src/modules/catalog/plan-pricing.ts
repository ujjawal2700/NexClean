/** Uses the same rounded per-wash price as individual bookings; totals round to paise. */
export function calculatePlanPrices(
  base: Record<string, number>, factor: number, washes: number, discount: number,
): Record<string, number> {
  if (!Number.isSafeInteger(washes) || washes <= 0) throw new Error("Washes per month must be a positive whole number");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error("Discount must be between 0 and 100%");
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("The selected package needs a positive multiplier in Pricing");
  const entries = Object.entries(base);
  if (!entries.length) throw new Error("Configure vehicle prices in Pricing first");
  return Object.fromEntries(entries.map(([key, value]) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Configure a positive base price for ${key} in Pricing`);
    const perWash = Math.round(value * factor / 10) * 10;
    const total = Math.round(perWash * washes * (1 - discount / 100) * 100) / 100;
    if (perWash <= 0 || !Number.isFinite(total)) throw new Error(`Invalid calculated price for ${key}`);
    return [key, total];
  }));
}
