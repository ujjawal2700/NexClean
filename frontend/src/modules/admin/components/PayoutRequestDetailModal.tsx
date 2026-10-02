import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, CheckCircle2, ClipboardCopy, Landmark, Loader2, Phone, XCircle } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { formatMoney, formatDate } from "@shared/lib/format";
import { copyText } from "@shared/lib/share";
import { usePayoutRequestDetail } from "../api/admin.api";
import { PAYOUT_REQUEST_STATUS_LABEL, PAYOUT_REQUEST_STATUS_STYLE } from "../lib/status";
import { CopyField, DetailModal } from "./DetailModal";

/**
 * Everything needed to pay a cleaner's payout request by hand: who they are,
 * the exact bank account to send to (as it was when they asked), where their
 * balance stands, and what they've been paid before.
 */
export function PayoutRequestDetailModal({
  id,
  onClose,
  onApprove,
  onReject,
  onMarkPaid,
  busy,
}: {
  id: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onMarkPaid: () => void;
  busy: boolean;
}) {
  const { data: r, isLoading, error } = usePayoutRequestDetail(id);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyAll = async () => {
    if (!r) return;
    const b = r.bankSnapshot;
    const text = [
      `Account holder: ${b.holderName}`,
      `Account number: ${b.accountNumber}`,
      `IFSC: ${b.ifsc}`,
      `Bank: ${b.bankName}`,
      `Branch: ${b.branch}`,
      `Amount: ${formatMoney(r.amount)}`,
    ].join("\n");
    if (await copyText(text)) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    }
  };

  return (
    <DetailModal
      title="Payout request"
      subtitle={r ? `Requested ${formatDate(r.createdAt)}` : undefined}
      onClose={onClose}
      testId="payout-request-detail"
      footer={
        r && (r.status === "pending" || r.status === "approved") ? (
          <div className="flex flex-wrap justify-end gap-2">
            {r.status === "pending" && (
              <>
                <Button variant="outline" size="sm" onClick={onReject} disabled={busy}>
                  <XCircle className="size-4" /> Decline
                </Button>
                <Button size="sm" onClick={onApprove} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                </Button>
              </>
            )}
            {r.status === "approved" && (
              <Button size="sm" onClick={onMarkPaid} disabled={busy}>
                <Banknote className="size-4" /> Mark as paid
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {isLoading || !r ? (
        <p className="text-sm text-muted">{error ? "Couldn't load this request." : "Loading…"}</p>
      ) : (
        <>
          {/* Amount + status */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Amount to pay</p>
              <p className="font-display text-3xl font-semibold text-ink">{formatMoney(r.amount)}</p>
            </div>
            <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYOUT_REQUEST_STATUS_STYLE[r.status])}>
              {PAYOUT_REQUEST_STATUS_LABEL[r.status]}
            </span>
          </div>
          {(r.processedAt || r.transactionRef || r.rejectionReason) && (
            <p className="-mt-2 text-xs text-muted">
              {r.processedAt && <>Processed {formatDate(r.processedAt)}{r.processedByName ? ` by ${r.processedByName}` : ""}. </>}
              {r.transactionRef && <>Transaction ref: <span className="font-medium text-ink">{r.transactionRef}</span>. </>}
              {r.rejectionReason && <>Reason: {r.rejectionReason}</>}
            </p>
          )}

          {/* Where the money goes */}
          <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Landmark className="size-4 text-primary" /> Transfer to
              </p>
              <Button variant="ghost" size="sm" onClick={copyAll}>
                <ClipboardCopy className="size-4" /> {copiedAll ? "Copied" : "Copy all"}
              </Button>
            </div>
            <div className="divide-y divide-line/60">
              <CopyField label="Account holder" value={r.bankSnapshot.holderName} large />
              <CopyField label="Account number" value={r.bankSnapshot.accountNumber} mono large />
              <CopyField label="IFSC" value={r.bankSnapshot.ifsc} mono />
              <CopyField label="Bank" value={r.bankSnapshot.bankName} />
              <CopyField label="Branch" value={r.bankSnapshot.branch} />
            </div>
            {r.bankChangedSinceRequest && (
              <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                The cleaner has changed their bank details since making this request. These are the details they
                asked to be paid to — check with them before transferring.
              </p>
            )}
          </section>

          {/* Who */}
          {r.agent && (
            <section className="space-y-2 rounded-2xl border border-line p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/admin/agents/${r.agent.id}`} onClick={onClose} className="font-semibold text-primary hover:underline">
                  {r.agent.name}
                </Link>
                <span className="text-xs capitalize text-muted">{r.agent.status}</span>
              </div>
              <dl className="grid grid-cols-[90px_1fr] gap-y-1">
                <dt className="text-muted">Phone</dt>
                <dd>
                  <a href={`tel:${r.agent.phone}`} className="inline-flex items-center gap-1 font-medium text-ink hover:text-primary">
                    <Phone className="size-3.5" /> {r.agent.phone}
                  </a>
                </dd>
                <dt className="text-muted">Email</dt>
                <dd className="break-all font-medium text-ink">{r.agent.email || "—"}</dd>
                <dt className="text-muted">Area</dt>
                <dd className="font-medium text-ink">{r.agent.area || "—"}</dd>
                <dt className="text-muted">Joined</dt>
                <dd className="font-medium text-ink">{formatDate(r.agent.joinedAt)}</dd>
              </dl>
            </section>
          )}

          {/* Balance */}
          {r.wallet && (
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total earned", value: r.wallet.totalEarned },
                { label: "Paid out", value: r.wallet.paidOut },
                { label: "In requests", value: r.wallet.reserved },
                { label: "Available", value: r.wallet.available },
              ].map((b) => (
                <div key={b.label} className="rounded-2xl border border-line p-3">
                  <p className="text-[11px] text-muted">{b.label}</p>
                  <p className="font-display text-base font-semibold text-ink">{formatMoney(b.value)}</p>
                </div>
              ))}
            </section>
          )}

          {/* History */}
          {r.history.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-semibold text-ink">Previous payout requests</p>
              <ul className="divide-y divide-line/60 rounded-2xl border border-line">
                {r.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="text-muted">{formatDate(h.createdAt)}</span>
                    <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-medium", PAYOUT_REQUEST_STATUS_STYLE[h.status])}>
                      {PAYOUT_REQUEST_STATUS_LABEL[h.status]}
                    </span>
                    <span className="font-medium text-ink">{formatMoney(h.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </DetailModal>
  );
}
