import { User } from "../user/user.model";
import { creditCoins } from "../wallet/wallet.service";
import { getReferralConfig } from "./referralConfig.service";
import { notifyUser } from "../notification/notification.service";

/**
 * Credit a newly signed-up user their welcome coins. Called from signup once
 * `referredBy` has been set. No-op if the program is off or the reward is zero.
 */
export async function creditRefereeWelcome(refereeId: string, referrerId: string) {
  const config = await getReferralConfig();
  if (!config.active || config.refereeReward <= 0) return;
  await creditCoins(refereeId, config.refereeReward, "referral_welcome", {
    note: "Welcome bonus for signing up with a referral code",
    relatedUser: referrerId,
  });
}

/**
 * Credit the referrer their reward the FIRST time their referee reaches a
 * qualifying milestone (first completed service or a subscription purchase).
 *
 * Idempotent: the `referralRewarded` flag is flipped atomically so concurrent
 * triggers (e.g. job-completion and subscribe firing together) credit only once.
 */
export async function maybeCreditReferrer(
  refereeId: string,
  // What the referee just did — only changes the wording of the referrer's notification.
  milestone: "service" | "subscription" = "service",
) {
  // Cheap pre-check: bail before consuming the one-time flag if there's nothing
  // to award, so a later trigger can still credit if the program is re-enabled.
  const config = await getReferralConfig();
  if (!config.active || config.referrerReward <= 0) return;

  // Atomically claim the one-time reward: only the update that actually flips
  // the flag proceeds to credit the referrer.
  // `referralFlagged` accounts were caught at signup as likely farming (several
  // referred signups from one device/IP). They keep the account; the payout is
  // withheld at both ends.
  const referee = await User.findOneAndUpdate(
    { _id: refereeId, referredBy: { $ne: null }, referralRewarded: { $ne: true }, referralFlagged: { $ne: true } },
    { $set: { referralRewarded: true } },
    { new: true },
  );
  if (!referee || !referee.referredBy) return;

  const referrerId = String(referee.referredBy);
  await creditCoins(referrerId, config.referrerReward, "referral_reward", {
    note: `Referral reward — ${referee.name} completed their first service`,
    relatedUser: refereeId,
  });

  // Tell the referrer the moment the coins land (push + in-app). Sent only
  // after the credit succeeds, and only once, because the flag above is claimed
  // atomically. A notification failure must not undo the reward.
  const friend = (referee.name || "").trim().split(/\s+/)[0] || "Your friend";
  const did = milestone === "subscription" ? "subscribed to a plan" : "completed their first service";
  const coins = config.referrerReward.toLocaleString("en-IN");
  await notifyUser(referrerId, {
    type: "system",
    title: `🎉 You earned ${coins} coins`,
    body: `Your friend ${friend} has successfully ${did} and you got ${coins} coins in your balance.`,
    data: { kind: "referral_reward", url: "/app/profile/refer/users" },
  }).catch((err) => console.error("referral reward notify failed:", (err as Error).message));
}
