import { useState } from "react";
import { X, FileSpreadsheet } from "lucide-react";
import { Button } from "@shared/ui/Button";

/**
 * Asks for an (optional) from/to date before an Excel export runs, so an admin
 * pulling "last month's payments" doesn't have to export everything and trim
 * it in a spreadsheet afterward. Either bound can be left blank — an empty
 * "from" means "the beginning", an empty "to" means "up to today".
 */
export function ExportDateRangeModal({
  title = "Export to Excel",
  description = "Choose a date range to export, or leave blank to export everything currently shown.",
  onExport,
  onClose,
}: {
  title?: string;
  description?: string;
  onExport: (range: { from: Date | null; to: Date | null }) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    // Inclusive of the whole "to" day, not just its midnight instant.
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    if (fromDate && toDate && fromDate > toDate) {
      setError("The 'from' date must be on or before the 'to' date");
      return;
    }
    onExport({ from: fromDate, to: toDate });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-muted">{description}</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">From</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">To</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            <FileSpreadsheet className="size-4" /> Export
          </Button>
        </div>
      </div>
    </div>
  );
}
