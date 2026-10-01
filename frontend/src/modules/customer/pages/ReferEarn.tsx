import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Copy, Check, Users, Share2, ChevronRight } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useReferralSummary } from "../api/queries";

export function ReferEarn() {
  const navigate = useNavigate();
  const { data: referrals } = useReferralSummary();
  const [copied, setCopied] = useState(false);
  const friends = referrals?.referredUsers ?? [];
  const rewarded = friends.filter((f) => f.stage === "rewarded").length;
  const waiting = friends.filter((f) => f.stage === "joined").length;

  const copyReferralCode = () => {
    if (!referrals?.referralCode) return;
    navigator.clipboard.writeText(referrals.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const shareCode = () => {
    if (!referrals?.referralCode) return;
    if (navigator.share) {
      navigator.share({
        title: "Join NexClean!",
        text: `Get a sparkling clean car with doorstep wash from NexClean! Use my referral code: ${referrals.referralCode} to sign up.`,
        url: window.location.origin,
      }).catch(console.error);
    } else {
      copyReferralCode();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Refer &amp; Earn</h1>
      </div>

      {/* Promotional Banner */}
      <GlassCard className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-indigo-500/5 border-primary/20">
        <div className="relative z-10 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            <Gift className="size-3.5" /> Referral Program
          </span>
          <h2 className="font-display text-2xl font-bold text-ink">Share the Love, Get Rewarded</h2>
          <p className="text-sm text-ink-soft max-w-xl leading-relaxed">
            Invite your friends to NexClean! You'll earn <span className="font-bold text-primary">{referrals?.rewardAmount ?? 100} coins</span> for every friend who signs up and completes their first service. Coins land in your wallet — redeem them for discounts at checkout!
          </p>
        </div>
      </GlassCard>

      {/* Stats and Sharing */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Your Code */}
        <GlassCard className="col-span-1 md:col-span-2 flex flex-col justify-between p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your Referral Code</p>
            <p className="text-xs text-muted mt-0.5">Friends enter this code during signup</p>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
              <span className="font-display text-xl font-bold tracking-[0.08em] text-primary">
                {referrals?.referralCode ?? "—"}
              </span>
              <Button variant="ghost" size="sm" onClick={copyReferralCode} disabled={!referrals?.referralCode} className="h-8">
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button variant="outline" onClick={shareCode} className="rounded-2xl" aria-label="Share">
              <Share2 className="size-4" />
            </Button>
          </div>
        </GlassCard>

        {/* Card 2: Coin balance */}
        <GlassCard className="flex flex-col justify-between p-5 bg-surface">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Coin Balance</p>
            <p className="text-xs text-muted mt-0.5">Redeemable at checkout</p>
          </div>
          <div className="mt-4">
            <h3 className="font-display text-2xl font-extrabold text-amber-500 sm:text-3xl">
              {(referrals?.coins ?? 0).toLocaleString("en-IN")} <span className="text-lg">coins</span>
            </h3>
            <p className="text-xs text-muted mt-1">
              ≈ {formatMoney(Math.floor((referrals?.coins ?? 0) / (referrals?.coinsPerRupee || 1)))} in value
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Referred friends live on their own page — a long list here buried the code and balance. */}
      <Link to="/app/profile/refer/users" className="block">
        <GlassCard className="flex items-center gap-4 p-5 transition-colors hover:border-primary/40">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-ink">Referred users</p>
            <p className="mt-0.5 text-xs text-muted">
              {friends.length === 0
                ? "No referrals yet. Friends who sign up with your code appear here."
                : `${friends.length} joined · ${rewarded} rewarded${waiting ? ` · ${waiting} yet to book` : ""}`}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted" />
        </GlassCard>
      </Link>
    </div>
  );
}
