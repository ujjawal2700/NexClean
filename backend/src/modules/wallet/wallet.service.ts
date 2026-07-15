import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { getReferralConfig } from "../promotions/referralConfig.service";
import { WalletTransaction, type WalletTxType } from "./walletTransaction.model";

type CreditMeta = { note?: string; relatedUser?: string; relatedBooking?: string };

/**
 * Credit coins to a user and append a ledger entry. The `$inc` returns the
 * post-update balance atomically, which we snapshot on the transaction.
 */
export async function creditCoins(userId: string, coins: number, type: WalletTxType, meta: CreditMeta = {}) {
  if (coins <= 0) return;
  const user = await User.findByIdAndUpdate(userId, { $inc: { coins } }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  await WalletTransaction.create({
    user: userId,
    type,
    coins,
    balanceAfter: user.coins,
    note: meta.note ?? "",
    relatedUser: meta.relatedUser ?? null,
    relatedBooking: meta.relatedBooking ?? null,
  });
  return user.coins;
}

/**
 * Redeem (debit) coins from a user's balance. Uses a conditional update so a
 * balance can never go negative under concurrent redemptions.
 */
export async function redeemCoins(userId: string, coins: number, meta: CreditMeta = {}) {
  if (coins <= 0) return;
  const user = await User.findOneAndUpdate(
    { _id: userId, coins: { $gte: coins } },
    { $inc: { coins: -coins } },
    { new: true },
  );
  if (!user) throw ApiError.badRequest("Insufficient coin balance");
  await WalletTransaction.create({
    user: userId,
    type: "redeem",
    coins: -coins,
    balanceAfter: user.coins,
    note: meta.note ?? "",
    relatedUser: meta.relatedUser ?? null,
    relatedBooking: meta.relatedBooking ?? null,
  });
  return user.coins;
}

/**
 * Given an order amount and how many coins the customer wants to spend, return
 * the actual coins consumed and the ₹ discount they buy — capped by the admin's
 * max-redeem %, the configured rate, and the customer's balance. Shared by
 * booking and subscription checkout so redemption behaves identically.
 */
export async function computeCoinRedemption(userId: string, orderAmount: number, coinsToRedeem?: number) {
  if (!coinsToRedeem || coinsToRedeem <= 0 || orderAmount <= 0) {
    return { coinsRedeemed: 0, coinDiscount: 0 };
  }
  const config = await getReferralConfig();
  const user = await User.findById(userId).select("coins");
  const availableCoins = Math.min(coinsToRedeem, user?.coins ?? 0);
  const maxRupees = Math.floor((orderAmount * config.maxRedeemPercent) / 100);
  const coinRupees = Math.floor(availableCoins / config.coinsPerRupee);
  const coinDiscount = Math.max(0, Math.min(coinRupees, maxRupees));
  const coinsRedeemed = coinDiscount * config.coinsPerRupee;
  return { coinsRedeemed, coinDiscount };
}

/** Wallet snapshot for the customer app: balance, its ₹ value, and recent history. */
export async function getWallet(userId: string) {
  const user = await User.findById(userId).select("coins");
  if (!user) throw ApiError.notFound("User not found");
  const { coinsPerRupee } = await getReferralConfig();
  const transactions = await WalletTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  return {
    coins: user.coins,
    coinsPerRupee,
    rupeeValue: Math.floor(user.coins / coinsPerRupee),
    transactions: transactions.map((t) => t.toJSON()),
  };
}
