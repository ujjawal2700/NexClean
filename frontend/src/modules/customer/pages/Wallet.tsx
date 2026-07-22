import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Gift, Users, ShoppingBag, Sparkles } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { useWallet } from "../api/queries";
import type { WalletTransaction } from "../types";

const TX_META: Record<WalletTransaction["type"], { label: string; icon: typeof Gift; tone: string }> = {
  referral_welcome: { label: "Welcome bonus", icon: Sparkles, tone: "text-primary bg-primary/10" },
  referral_reward: { label: "Referral reward", icon: Users, tone: "text-amber-600 bg-amber-500/10" },
  redeem: { label: "Redeemed at checkout", icon: ShoppingBag, tone: "text-rose-600 bg-rose-500/10" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function Wallet() {
  const navigate = useNavigate();
  const { data: wallet, isLoading } = useWallet();
  const transactions = wallet?.transactions ?? [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Wallet</h1>
      </div>

      {/* Balance */}
      <GlassCard className="relative overflow-hidden bg-gradient-to-br from-amber-400/15 to-primary/5 border-amber-400/20">
        <div className="relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700">
            <Coins className="size-3.5" /> Coin Balance
          </span>
          <div>
            <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {(wallet?.coins ?? 0).toLocaleString("en-IN")} <span className="text-2xl text-amber-600">coins</span>
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              Worth {formatMoney(wallet?.rupeeValue ?? 0)} · use them for discounts when you book or subscribe.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/app/profile/refer")} className="rounded-2xl">
            <Gift className="size-4" /> Earn more coins
          </Button>
        </div>
      </GlassCard>

      {/* Transactions */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <Coins className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-ink">Transaction History</h2>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted">Loading your wallet…</p>
        ) : transactions.length === 0 ? (
          <div className="text-center p-10 bg-surface border border-line border-dashed rounded-2xl">
            <Coins className="size-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-ink-soft font-semibold">No transactions yet</p>
            <p className="text-xs text-muted max-w-xs mx-auto mt-1 leading-relaxed">
              Refer friends to earn coins, then redeem them for discounts at checkout.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const meta = TX_META[tx.type];
              const Icon = meta.icon;
              const isCredit = tx.coins > 0;
              return (
                <GlassCard key={tx.id} className="flex items-center gap-3 p-4 bg-surface">
                  <div className={cn("flex size-10 items-center justify-center rounded-xl shrink-0", meta.tone)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{meta.label}</p>
                    <p className="text-xs text-muted truncate">{tx.note || formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold", isCredit ? "text-emerald-600" : "text-rose-600")}>
                      {isCredit ? "+" : ""}{tx.coins.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-muted">Bal {tx.balanceAfter.toLocaleString("en-IN")}</p>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
