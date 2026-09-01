import { useState } from "react";
import { Banknote, Clock, CheckCircle2, XCircle, Landmark } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { ApiError } from "@shared/lib/api";
import {
  usePayoutRequests,
  useApprovePayoutRequest,
  useRejectPayoutRequest,
  useMarkPayoutRequestPaid,
} from "../api/admin.api";
import { ConfirmActionModal } from "../components/PersonFormModal";
import { StatCard } from "../components/StatCard";
import { PAYOUT_REQUEST_STATUS_STYLE, PAYOUT_REQUEST_STATUS_LABEL } from "../lib/status";
import type { AdminPayoutRequest, PayoutRequestStatus } from "../types";

const TABS: { key: PayoutRequestStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Declined" },
];

export function PayoutRequests() {
  const [tab, setTab] = useState<PayoutRequestStatus | "all">("pending");
  const { data: requests = [], isLoading } = usePayoutRequests(tab);
  const approve = useApprovePayoutRequest();
  const reject = useRejectPayoutRequest();
  const markPaid = useMarkPayoutRequestPaid();
  const paginated = usePagination(requests, 10);

  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<AdminPayoutRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [paying, setPaying] = useState<AdminPayoutRequest | null>(null);
  const [transactionRef, setTransactionRef] = useState("");

  // Tallies are computed from whatever tab is loaded rather than a separate
  // stats call — this list is never large enough (payout requests, not every
  // payment ever made) to make a second aggregate query worth the round trip.
  const pendingTotal = requests.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const approvedTotal = requests.filter((r) => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const paidTotal = requests.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);

  const handleApprove = (id: string) => {
    setError("");
    approve.mutate(id, {
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't approve this request"),
    });
  };

  const handleReject = () => {
    if (!rejecting) return;
    setError("");
    reject.mutate(
      { id: rejecting.id, reason: rejectReason },
      {
        onSuccess: () => {
          setRejecting(null);
          setRejectReason("");
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't decline this request"),
      },
    );
  };

  const handleMarkPaid = () => {
    if (!paying) return;
    setError("");
    markPaid.mutate(
      { id: paying.id, transactionRef },
      {
        onSuccess: () => {
          setPaying(null);
          setTransactionRef("");
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't mark this as paid"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Payout Requests</h1>
        <p className="mt-1 text-muted">Cleaners cashing out their earned balance to their bank account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting review" value={formatMoney(pendingTotal)} icon={Clock} />
        <StatCard label="Approved, not yet sent" value={formatMoney(approvedTotal)} icon={Banknote} />
        <StatCard label="Paid out" value={formatMoney(paidTotal)} icon={CheckCircle2} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Requested</th>
              <th className="px-2 py-2 font-medium">Bank account</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paginated.pageItems.map((r) => (
              <tr key={r.id} className="border-t border-line/70 align-top">
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{r.agent?.name ?? "Deleted agent"}</p>
                  <p className="text-xs text-muted">{r.agent?.phone}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(r.createdAt)}</td>
                <td className="px-2 py-3 text-ink-soft">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <Landmark className="size-3.5 text-muted" /> {r.bankSnapshot.bankName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{r.bankSnapshot.holderName}</p>
                  <p className="text-xs text-muted">
                    {r.bankSnapshot.accountNumber} · {r.bankSnapshot.ifsc}
                  </p>
                  <p className="text-xs text-muted">{r.bankSnapshot.branch}</p>
                </td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYOUT_REQUEST_STATUS_STYLE[r.status])}>
                    {PAYOUT_REQUEST_STATUS_LABEL[r.status]}
                  </span>
                  {r.status === "rejected" && r.rejectionReason && (
                    <p className="mt-1 max-w-[220px] text-xs text-muted">{r.rejectionReason}</p>
                  )}
                  {r.status === "paid" && r.transactionRef && (
                    <p className="mt-1 text-xs text-muted">Ref: {r.transactionRef}</p>
                  )}
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(r.amount)}</td>
                <td className="px-2 py-3 text-right">
                  {r.status === "pending" && (
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" disabled={approve.isPending} onClick={() => handleApprove(r.id)}>
                        <CheckCircle2 className="size-4" /> Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          setError("");
                          setRejectReason("");
                          setRejecting(r);
                        }}
                      >
                        <XCircle className="size-4" /> Decline
                      </Button>
                    </div>
                  )}
                  {r.status === "approved" && (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setError("");
                          setTransactionRef("");
                          setPaying(r);
                        }}
                      >
                        <Banknote className="size-4" /> Mark paid
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          setError("");
                          setRejectReason("");
                          setRejecting(r);
                        }}
                      >
                        <XCircle className="size-4" /> Decline
                      </Button>
                    </div>
                  )}
                  {(r.status === "paid" || r.status === "rejected") && <span className="text-xs text-muted">—</span>}
                </td>
              </tr>
            ))}
            {!isLoading && paginated.pageItems.length === 0 && (
              <tr className="border-t border-line/70">
                <td colSpan={6} className="px-2 py-8 text-center text-sm text-muted">
                  No {tab === "all" ? "" : PAYOUT_REQUEST_STATUS_LABEL[tab as PayoutRequestStatus].toLowerCase() + " "}
                  payout requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={paginated.page} totalPages={paginated.totalPages} onPageChange={paginated.setPage} />
      </GlassCard>

      <ConfirmActionModal
        open={!!rejecting}
        title="Decline this payout request?"
        description={
          <div className="space-y-2">
            <p>
              <span className="font-medium text-ink">{rejecting?.agent?.name}</span>'s request for{" "}
              {rejecting && formatMoney(rejecting.amount)} goes back into their available balance to request again.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Reason (shown to the agent)</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-line bg-surface/80 px-3 py-2 text-sm text-ink outline-none focus:border-primary/50"
                placeholder="e.g. Account details don't match the name on file"
              />
            </label>
          </div>
        }
        confirmLabel="Decline request"
        destructive
        pending={reject.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={handleReject}
      />

      <ConfirmActionModal
        open={!!paying}
        title="Mark this payout as paid?"
        description={
          <div className="space-y-2">
            <p>
              Confirms {formatMoney(paying?.amount ?? 0)} has actually been sent to{" "}
              <span className="font-medium text-ink">{paying?.agent?.name}</span>'s bank account — this app doesn't
              move the money itself, it only records that you did.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted">Transaction reference (optional)</span>
              <Input
                name="transactionRef"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="UTR / reference number"
              />
            </label>
          </div>
        }
        confirmLabel="Mark as paid"
        pending={markPaid.isPending}
        onClose={() => setPaying(null)}
        onConfirm={handleMarkPaid}
      />
    </div>
  );
}
