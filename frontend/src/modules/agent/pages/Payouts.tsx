import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Lock, IndianRupee, Landmark, Loader2, CheckCircle2, Clock, XCircle, Banknote } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatDate, formatMoney } from "@shared/lib/format";
import { ApiError } from "@shared/lib/api";
import { useBankAccount, useWallet, useRequestPayout } from "../api/agent.api";
import type { PayoutRequestStatus } from "../types";

const STATUS_STYLE: Record<PayoutRequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-primary/10 text-primary",
  paid: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};
const STATUS_LABEL: Record<PayoutRequestStatus, string> = {
  pending: "Under review",
  approved: "Approved",
  paid: "Paid",
  rejected: "Declined",
};
const STATUS_ICON: Record<PayoutRequestStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  paid: Banknote,
  rejected: XCircle,
};

const MIN_PAYOUT = 100;

export function Payouts() {
  const navigate = useNavigate();
  const { data: bankAccount, isLoading: bankLoading } = useBankAccount();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const requestPayout = useRequestPayout();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const available = wallet?.available ?? 0;
  const parsedAmount = Number(amount);
  const canRequest =
    !!bankAccount &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_PAYOUT &&
    parsedAmount <= available;

  const submit = () => {
    setError("");
    requestPayout.mutate(parsedAmount, {
      onSuccess: () => {
        setAmount("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't submit your payout request"),
    });
  };

  const isLoading = bankLoading || walletLoading;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Payouts</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="font-display text-lg font-bold text-ink">{formatMoney(wallet?.totalEarned ?? 0)}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Total earned</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="font-display text-lg font-bold text-ink">{formatMoney(wallet?.reserved ?? 0)}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Requested / paid</p>
        </GlassCard>
        <GlassCard className="p-4 text-center border-primary/30 bg-primary/5">
          <p className="font-display text-lg font-bold text-primary">{formatMoney(available)}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Available</p>
        </GlassCard>
      </div>

      {!isLoading && !bankAccount ? (
        <GlassCard className="flex items-start gap-3 border-amber-500/30 bg-amber-50/60">
          <Landmark className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-display font-semibold text-ink">Add a bank account to get paid</p>
            <p className="mt-1 text-sm text-muted">
              You need to save where payouts should go before you can request one.
            </p>
            <Link to="/agent/profile/bank-account">
              <Button size="sm" className="mt-3">
                <Landmark className="size-4" /> Add bank account
              </Button>
            </Link>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-ink">Request a payout</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Landmark className="size-3.5" /> {bankAccount?.bankName} ••••{bankAccount?.accountNumber.slice(-4)}
            </p>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" /> Payout requested — an admin will review it shortly.
            </div>
          )}

          <div className="flex items-end gap-2">
            <Input
              label="Amount"
              name="amount"
              inputMode="numeric"
              placeholder={`Min ${formatMoney(MIN_PAYOUT)}`}
              leading={<IndianRupee className="size-4" />}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={available < MIN_PAYOUT}
              onClick={() => setAmount(String(available))}
            >
              Max
            </Button>
          </div>
          {parsedAmount > available && amount && (
            <p className="text-xs text-red-500">You only have {formatMoney(available)} available right now.</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full" onClick={submit} disabled={!canRequest || requestPayout.isPending}>
            {requestPayout.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            {requestPayout.isPending ? "Requesting…" : "Request payout"}
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> Reviewed by an admin, then transferred to the account on file.
          </p>
        </GlassCard>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Request history</h2>
        {isLoading ? (
          <GlassCard className="py-10 text-center text-muted">Loading…</GlassCard>
        ) : !wallet?.requests.length ? (
          <GlassCard className="py-10 text-center text-muted">No payout requests yet.</GlassCard>
        ) : (
          <div className="space-y-3">
            {wallet.requests.map((r) => {
              const Icon = STATUS_ICON[r.status];
              return (
                <GlassCard key={r.id} className="flex items-start gap-4">
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-2xl",
                      STATUS_STYLE[r.status],
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display font-semibold text-ink">{formatMoney(r.amount)}</p>
                      <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">Requested {formatDate(r.createdAt)}</p>
                    {r.status === "rejected" && r.rejectionReason && (
                      <p className="mt-1 text-xs text-red-600">{r.rejectionReason}</p>
                    )}
                    {r.status === "paid" && r.transactionRef && (
                      <p className="mt-1 text-xs text-muted">Ref: {r.transactionRef}</p>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
