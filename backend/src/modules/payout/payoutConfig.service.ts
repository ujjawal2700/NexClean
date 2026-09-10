import { PayoutConfig, type PayoutConfigDoc } from "./payoutConfig.model";

export type PayoutRule = {
  mode: "percent" | "flat";
  percent: number;
  flatAmount: number;
  minPayout: number;
  maxPayout: number;
};

/** The rule applied before an admin has ever saved one — the historical 70% split. */
export const DEFAULT_PAYOUT_RULE: PayoutRule = {
  mode: "percent",
  percent: 70,
  flatAmount: 0,
  minPayout: 0,
  maxPayout: 0,
};

function mapConfig(c: PayoutConfigDoc): PayoutRule {
  return {
    mode: c.mode as "percent" | "flat",
    percent: c.percent,
    flatAmount: c.flatAmount,
    minPayout: c.minPayout,
    maxPayout: c.maxPayout,
  };
}

/** Fetch the single global payout config, creating it with defaults on first access. */
export async function getPayoutConfigDoc(): Promise<PayoutConfigDoc> {
  const existing = await PayoutConfig.findById("global");
  if (existing) return existing;
  return PayoutConfig.create({ _id: "global" });
}

export async function getPayoutConfig(): Promise<PayoutRule> {
  return mapConfig(await getPayoutConfigDoc());
}

export async function updatePayoutConfig(patch: Partial<PayoutRule>): Promise<PayoutRule> {
  const config = await PayoutConfig.findByIdAndUpdate(
    "global",
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  return mapConfig(config!);
}

/**
 * What a cleaner earns on a job of the given price, in whole rupees.
 * Pure and synchronous so a list of jobs can be priced from one config read.
 */
export function computePayout(price: number, rule: PayoutRule = DEFAULT_PAYOUT_RULE): number {
  const base = rule.mode === "flat" ? rule.flatAmount : (price * rule.percent) / 100;
  let payout = Math.round(base);
  if (rule.minPayout > 0) payout = Math.max(payout, rule.minPayout);
  // A cap of 0 means "uncapped" — clamping to ₹0 is never a real intent.
  if (rule.maxPayout > 0) payout = Math.min(payout, rule.maxPayout);
  // Never pay out more than the job was sold for; a flat rate or a floor above
  // the price would otherwise make the booking loss-making without any warning.
  return Math.max(0, Math.min(payout, Math.round(price)));
}

/**
 * Read the config once and hand back a pricing function. Callers mapping a list
 * of bookings use this so one request doesn't fan out into a query per job.
 */
export async function payoutCalculator(): Promise<(price: number) => number> {
  const rule = await getPayoutConfig();
  return (price: number) => computePayout(price, rule);
}
