import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Copy, Check, Users, Share2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { useReferralSummary } from "../api/queries";

export function ReferEarn() {
  const navigate = useNavigate();
  const { data: referrals } = useReferralSummary();
  const [copied, setCopied] = useState(false);

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

      {/* Referrals Journey */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 pb-1">
          <Users className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Referred Friends' Journey</h2>
        </div>

        {referrals?.referredUsers && referrals.referredUsers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {referrals.referredUsers.map((user) => {
              const isJoined = true; // Friend joined because they are in the list
              const isWashCompleted = user.status === "First Clean Done" || user.status === "Subscribed";
              const isRewarded = user.status === "First Clean Done" || user.status === "Subscribed";

              return (
                <GlassCard key={user.id} className="p-5 border border-line bg-surface flex flex-col justify-between space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold text-ink text-base leading-snug">{user.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Joined on {new Date(user.joinedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      isRewarded 
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                        : "bg-blue-100 text-blue-800 border border-blue-200"
                    )}>
                      {user.status === "Subscribed" ? "Subscribed" : isRewarded ? "Rewarded" : "Signed Up"}
                    </span>
                  </div>

                  {/* Visual Journey Steps */}
                  <div className="relative pt-2">
                    {/* Horizontal Line background */}
                    <div className="absolute top-[18px] left-[15%] right-[15%] h-1 bg-line rounded-full z-0">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-700" 
                        style={{ width: isRewarded ? "100%" : "0%" }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 relative z-10">
                      {/* Step 1: Sign up */}
                      <div className="flex flex-col items-center text-center">
                        <div className={cn(
                          "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300",
                          isJoined ? "bg-primary text-white" : "bg-line text-muted"
                        )}>
                          ✓
                        </div>
                        <span className="mt-2 text-[11px] font-bold text-ink leading-tight">Signed Up</span>
                        <span className="text-[9px] text-muted">Success</span>
                      </div>

                      {/* Step 2: First Wash */}
                      <div className="flex flex-col items-center text-center">
                        <div className={cn(
                          "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300",
                          isWashCompleted 
                            ? "bg-primary text-white" 
                            : "bg-surface border border-line text-muted"
                        )}>
                          {isWashCompleted ? "✓" : "2"}
                        </div>
                        <span className="mt-2 text-[11px] font-bold text-ink leading-tight">First Wash</span>
                        <span className="text-[9px] text-muted leading-tight">
                          {isWashCompleted ? "Completed" : "Awaiting wash"}
                        </span>
                      </div>

                      {/* Step 3: Reward */}
                      <div className="flex flex-col items-center text-center">
                        <div className={cn(
                          "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300",
                          isRewarded 
                            ? "bg-emerald-500 text-white" 
                            : "bg-surface border border-line text-muted"
                        )}>
                          {isRewarded ? "₹" : "3"}
                        </div>
                        <span className="mt-2 text-[11px] font-bold text-ink leading-tight">Reward</span>
                        <span className="text-[9px] font-medium text-amber-600">
                          {isRewarded ? `+${referrals.rewardAmount || 100} coins` : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <div className="text-center p-10 bg-surface border border-line border-dashed rounded-2xl">
            <Users className="size-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-ink-soft font-semibold">No referrals yet</p>
            <p className="text-xs text-muted max-w-xs mx-auto mt-1 leading-relaxed">
              When friends sign up using your referral code, they'll appear here along with their step-by-step reward journey!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
