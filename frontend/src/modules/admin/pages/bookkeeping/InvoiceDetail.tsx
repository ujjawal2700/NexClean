import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, Loader2, Pencil, X } from "lucide-react";
import { ApiError } from "@shared/lib/api";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { InvoiceDocument } from "@shared/components/InvoiceDocument";
import { downloadInvoicePdf } from "@shared/lib/invoicePdf";
import type { Invoice } from "@shared/lib/invoice";
import { useInvoice, useUpdateInvoice } from "../../api/bookkeeping.api";

type Draft = { billTo: Invoice["billTo"]; notes: string; lines: { description: string; sac: string }[] };

const draftOf = (inv: Invoice): Draft => ({
  billTo: { ...inv.billTo },
  notes: inv.notes ?? "",
  lines: inv.lines.map((l) => ({ description: l.description, sac: l.sac ?? "" })),
});

/**
 * One invoice: the document as the customer sees it, plus editing of what can
 * legitimately be corrected — bill-to details (name, address, customer GSTIN),
 * line wording/SAC and notes. Amounts always follow the booking.
 */
export function InvoiceDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useInvoice(id);
  const update = useUpdateInvoice(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (data && !editing) setDraft(draftOf(data.invoice));
  }, [data, editing]);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading invoice…
      </p>
    );
  }
  if (isError || !data || !draft) {
    return (
      <GlassCard className="text-center">
        <p className="font-display text-lg font-semibold text-ink">Invoice not found</p>
        <Button className="mt-4" onClick={() => navigate("/admin/bookkeeping/invoices")}>
          Back to invoices
        </Button>
      </GlassCard>
    );
  }

  const inv = data.invoice;
  // Preview edits live, before saving.
  const preview: Invoice = editing
    ? {
        ...inv,
        billTo: draft.billTo,
        notes: draft.notes,
        lines: inv.lines.map((l, i) => ({ ...l, description: draft.lines[i]?.description ?? l.description, sac: draft.lines[i]?.sac ?? l.sac })),
      }
    : inv;

  const save = () => {
    update.mutate(
      {
        billTo: draft.billTo,
        notes: draft.notes,
        lines: draft.lines.map((l, index) => ({ index, description: l.description.trim() || inv.lines[index].description, sac: l.sac })),
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(preview, data.template);
    } finally {
      setDownloading(false);
    }
  };

  const setBill = (k: keyof Invoice["billTo"], v: string) => setDraft((d) => d && { ...d, billTo: { ...d.billTo, [k]: v } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/admin/bookkeeping/invoices")}
            aria-label="Back to invoices"
            className="mt-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-mono text-2xl font-semibold text-ink">{inv.invoiceNumber}</h1>
            <p className="text-sm text-muted">
              Booking{" "}
              <Link to={`/admin/bookings/${inv.booking}`} className="font-medium text-primary hover:underline">
                #{inv.booking.slice(-8)}
              </Link>
              {inv.revision > 0 && inv.editedAt && (
                <>
                  {" "}
                  · edited {inv.revision}× · last by {inv.editedBy} on {new Date(inv.editedAt).toLocaleString("en-IN")}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
                <X className="size-4" /> Cancel
              </Button>
              <Button onClick={save} disabled={update.isPending} data-testid="save-invoice">
                {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} data-testid="edit-invoice">
                <Pencil className="size-4" /> Edit
              </Button>
              <Button onClick={download} disabled={downloading}>
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {update.isError && (
        <p className="rounded-2xl border border-red-300/60 bg-red-50/40 px-4 py-3 text-sm text-red-600">
          {update.error instanceof ApiError ? update.error.message : "Couldn't save the invoice."}
        </p>
      )}

      <div className={editing ? "grid gap-6 xl:grid-cols-[380px_1fr]" : ""}>
        {editing && (
          <GlassCard className="h-fit space-y-5" data-testid="invoice-editor">
            <div className="space-y-3">
              <p className="font-display font-semibold text-ink">Bill to</p>
              <Input name="billName" label="Name" value={draft.billTo.name} onChange={(e) => setBill("name", e.target.value)} />
              <Input name="billPhone" label="Phone" value={draft.billTo.phone} onChange={(e) => setBill("phone", e.target.value)} />
              <Input name="billEmail" label="Email" value={draft.billTo.email} onChange={(e) => setBill("email", e.target.value)} />
              <Input name="billAddress" label="Billing address" value={draft.billTo.address} onChange={(e) => setBill("address", e.target.value)} />
              <Input
                name="billGstin"
                label="Customer GSTIN (for business customers)"
                placeholder="22AAAAA0000A1Z5"
                value={draft.billTo.gstin}
                onChange={(e) => setBill("gstin", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <p className="font-display font-semibold text-ink">Line items</p>
              {draft.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_96px] gap-2">
                  <input
                    aria-label={`Line ${i + 1} description`}
                    value={l.description}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })
                    }
                    className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                  />
                  <input
                    aria-label={`Line ${i + 1} SAC`}
                    placeholder="SAC"
                    value={l.sac}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, sac: e.target.value } : x)) })
                    }
                    className="h-10 rounded-xl border border-line bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-primary/50"
                  />
                </div>
              ))}
              <p className="text-xs text-muted">
                Amounts can't be edited here — they always follow the booking. Change the booking and the invoice updates.
              </p>
            </div>
            <div className="space-y-1.5 border-t border-line pt-4">
              <label htmlFor="invoiceNotes" className="font-display font-semibold text-ink">
                Notes
              </label>
              <textarea
                id="invoiceNotes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((d) => d && { ...d, notes: e.target.value })}
                placeholder="Shown on the invoice under Notes"
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-primary/50"
              />
            </div>
          </GlassCard>
        )}
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <InvoiceDocument invoice={preview} template={data.template} />
          </div>
        </div>
      </div>
    </div>
  );
}
