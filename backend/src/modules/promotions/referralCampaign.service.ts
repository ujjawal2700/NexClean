import { ReferralCampaign, type ReferralCampaignDoc } from "./referralCampaign.model";
import { ApiError } from "../../shared/utils/ApiError";

function mapCampaign(c: ReferralCampaignDoc) {
  return {
    id: c.id,
    name: c.name,
    referrerReward: c.referrerReward,
    refereeReward: c.refereeReward,
    description: c.description,
    active: c.active,
  };
}

export async function listReferralCampaigns() {
  const campaigns = await ReferralCampaign.find().sort({ createdAt: -1 });
  return campaigns.map(mapCampaign);
}

export async function createReferralCampaign(input: {
  name: string;
  referrerReward: number;
  refereeReward: number;
  description?: string;
}) {
  return mapCampaign(await ReferralCampaign.create(input));
}

export async function updateReferralCampaign(
  id: string,
  patch: { name?: string; referrerReward?: number; refereeReward?: number; description?: string; active?: boolean },
) {
  const campaign = await ReferralCampaign.findByIdAndUpdate(id, patch, { new: true });
  if (!campaign) throw ApiError.notFound("Referral campaign not found");
  return mapCampaign(campaign);
}

export async function deleteReferralCampaign(id: string) {
  const campaign = await ReferralCampaign.findByIdAndDelete(id);
  if (!campaign) throw ApiError.notFound("Referral campaign not found");
}
