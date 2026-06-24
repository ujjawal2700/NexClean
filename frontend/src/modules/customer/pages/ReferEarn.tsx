import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Gift, Copy, Check, Users } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useReferralSummary } from "../api/queries";

export function ReferEarn() {
  const { data: referrals } = useReferralSummary();
  const [copied, setCopied] = useState(false);

  const copyReferralCode = () => {
    if (!referrals?.referralCode) return;
    navigator.clipboard.writeText(referrals.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/profile" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> Profile
        </Link>
        <h1 className="font-display text-3xl text-ink">Refer & earn</h1>
      </div>

      <GlassCard>
        <p className="mt-1 text-sm text-muted">
          Share your code with friends — you both get rewarded when they join.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3.5">
            <span className="font-display text-xl font-semibold tracking-[0.08em] text-primary">
              {referrals?.referralCode ?? "—"}
            </span>
            <Button variant="ghost" size="sm" onClick={copyReferralCode} disabled={!referrals?.referralCode}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Gift className="size-5" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-ink">
                {formatMoney(referrals?.referralEarnings ?? 0)}
              </p>
              <p className="text-sm text-muted">Total earnings</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-ink">
            <Users className="size-4 text-muted" /> Friends you referred
          </p>
          {referrals?.referredUsers.length ? (
            <div className="space-y-2">
              {referrals.referredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
                >
                  <span className="font-medium text-ink">{u.name}</span>
                  <span className="text-sm text-muted">
                    Joined{" "}
                    {new Date(u.joinedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No referrals yet — share your code to get started.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
