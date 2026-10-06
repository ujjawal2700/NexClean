import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { GlassCard } from "@shared/ui/GlassCard";
import { InvoiceDocument } from "@shared/components/InvoiceDocument";
import { downloadInvoicePdf } from "@shared/lib/invoicePdf";
import { useBookingInvoice } from "../api/queries";

/** The booking's tax invoice, on screen and as a PDF download. */
export function BookingInvoice() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBookingInvoice(id);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(data.invoice, data.template);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/app/bookings/${id}`))}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
          aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Invoice</h1>
        <Button size="sm" className="ml-auto" onClick={download} disabled={!data || downloading} data-testid="invoice-download">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} PDF
        </Button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" /> Preparing your invoice…
        </p>
      ) : isError || !data ? (
        <GlassCard className="text-center">
          <p className="font-display text-lg font-semibold text-ink">We couldn't load this invoice</p>
          <Button className="mt-4" onClick={() => navigate("/app/bookings", { replace: true })}>
            See all bookings
          </Button>
        </GlassCard>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="min-w-[640px]">
            <InvoiceDocument invoice={data.invoice} template={data.template} />
          </div>
        </div>
      )}
    </div>
  );
}
