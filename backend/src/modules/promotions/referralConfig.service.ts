import { ReferralConfig, type ReferralConfigDoc } from "./referralConfig.model";

function mapConfig(c: ReferralConfigDoc) {
  return {
    referrerReward: c.referrerReward,
    refereeReward: c.refereeReward,
    coinsPerRupee: c.coinsPerRupee,
    maxRedeemPercent: c.maxRedeemPercent,
    active: c.active,
  };
}

/** Fetch the single global referral config, creating it with defaults on first access. */
export async function getReferralConfigDoc(): Promise<ReferralConfigDoc> {
  const existing = await ReferralConfig.findById("global");
  if (existing) return existing;
  return ReferralConfig.create({ _id: "global" });
}

export async function getReferralConfig() {
  return mapConfig(await getReferralConfigDoc());
}

export async function updateReferralConfig(patch: {
  referrerReward?: number;
  refereeReward?: number;
  coinsPerRupee?: number;
  maxRedeemPercent?: number;
  active?: boolean;
}) {
  const config = await ReferralConfig.findByIdAndUpdate(
    "global",
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return mapConfig(config!);
}
