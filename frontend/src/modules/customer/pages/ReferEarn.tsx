import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Copy, Check, Users, Share2, ChevronRight } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useReferralSummary } from "../api/queries";
import { referralInviteUrl } from "@shared/lib/site";
import { shareOrCopy, copyText } from "@shared/lib/share";

export function ReferEarn() {
  const navigate = useNavigate();
  const { data: referrals } = useReferralSummary();
  const [copied, setCopied] = useState(false);
  const friends = referrals?.referredUsers ?? [];
  const rewarded = friends.filter((f) => f.stage === "rewarded").length;
  const waiting = friends.filter((f) => f.stage === "joined").length;

  // What happened after Share when no share sheet was available.
  const [shareNote, setShareNote] = useState<"copied" | "failed" | null>(null);
  const inviteLink = referrals?.referralCode ? referralInviteUrl(referrals.referralCode) : "";

  const copyReferralCode = async () => {
    if (!referrals?.referralCode) return;
    if (await copyText(referrals.referralCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const shareCode = async () => {
    if (!referrals?.referralCode) return;
    // The link opens the NexClean app when installed (sign-up with the code
    // applied), or sign-up on the web otherwise.
    const outcome = await shareOrCopy({
      title: "Join NexClean!",
      text: `Get a sparkling clean car with doorstep wash from NexClean! Sign up with my referral code ${referrals.referralCode}:`,
      url: inviteLink,
    });
    setShareNote(outcome === "shared" ? null : outcome);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* Title block */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
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
      <GlassCard className="relative overflow-hidden p-4 bg-gradient-to-br from-primary/10 to-indigo-500/5 border-primary/20">
        <div className="relative z-10 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            <Gift className="size-3.5" /> Referral Program
          </span>
          <h2 className="font-display text-xl font-bold text-ink">Invite friends, earn rewards</h2>
          <p className="text-sm text-ink-soft max-w-xl leading-relaxed">
            Earn <span className="font-bold text-primary">{referrals?.rewardAmount ?? 100} coins</span> when a friend signs up and completes their first service. Use your coins for discounts at checkout.
          </p>
        </div>
      </GlassCard>

      {/* Stats and Sharing */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* Card 1: Your Code */}
        <GlassCard className="col-span-1 md:col-span-2 flex flex-col justify-between p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your Referral Code</p>
            <p className="text-xs text-muted mt-0.5">Friends enter this code during signup</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="min-w-0 w-full flex items-center justify-between gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
              <span className="min-w-0 break-all font-display text-lg font-bold tracking-wide text-primary">
                {referrals?.referralCode ?? "—"}
              </span>
              <Button variant="ghost" size="sm" onClick={copyReferralCode} disabled={!referrals?.referralCode} className="min-h-11 shrink-0">
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button variant="outline" onClick={shareCode} className="w-full rounded-xl" disabled={!referrals?.referralCode} aria-label="Share">
              <Share2 className="size-4" /> Share invite
            </Button>
          </div>
          {shareNote === "copied" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600" role="status">
              <Check className="size-3.5" /> Invite link copied — paste it into WhatsApp or a message.
            </p>
          )}
          {shareNote === "failed" && (
            <div className="mt-3 space-y-1.5" role="status">
              <p className="text-xs text-muted">Copy this invite link and send it to your friends:</p>
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 w-full select-text rounded-xl border border-line bg-surface px-3 text-sm text-ink"
                aria-label="Invite link"
              />
            </div>
          )}
        </GlassCard>

        {/* Card 2: Coin balance */}
        <GlassCard className="flex flex-col justify-between p-4 bg-surface">
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
        <GlassCard className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
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
