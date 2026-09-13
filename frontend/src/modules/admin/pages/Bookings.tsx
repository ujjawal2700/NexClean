import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, X, Wand2, Calendar, Loader2, Eye, FileSpreadsheet } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import { usePagination } from "@shared/lib/usePagination";
import {
  useBookings,
  useCancelBooking,
  useAgents,
  useAssignBooking,
  useAutoAssignBooking,
  useRescheduleBooking,
  useRescheduleQuote,
  type AdminRescheduleQuote,
  useSetBookingStatus,
  useCategoryLabel,
} from "../api/admin.api";
import { type BookingStatus, type AdminBooking } from "../types";
import { BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL } from "../lib/status";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";

const TIME_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

const FILTERS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_OPTIONS: { id: BookingStatus; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function RescheduleModal({
  booking,
  onClose,
}: {
  booking: AdminBooking;
  onClose: () => void;
}) {
  const reschedule = useRescheduleBooking();
  const quoteReschedule = useRescheduleQuote();
  const initialDate = booking.date ? new Date(booking.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState(booking.slot || TIME_SLOTS[0]);
  const [waive, setWaive] = useState(false);
  const [quote, setQuote] = useState<AdminRescheduleQuote | null>(null);

  // Price the move as the admin picks it, so the cost of a goodwill decision is
  // visible before they make it rather than discovered afterwards.
  useEffect(() => {
    setQuote(null);
    if (!date || !slot) return;
    let cancelled = false;
    quoteReschedule.mutate(
      { id: booking.id, date, slot },
      { onSuccess: (q) => !cancelled && setQuote(q) },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slot, booking.id]);

  const submit = () => {
    if (!date || !slot) return;
    reschedule.mutate(
      { id: booking.id, date, slot, waiveUpgrade: waive || undefined },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            Reschedule Booking
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm text-muted">
          Reschedule <span className="font-medium text-ink">{booking.vehicleName}</span> ({booking.customerName}) to a new date & time slot.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Select Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Select Time Slot</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            >
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* An admin move costs the customer the same as their own would, unless
            it is explicitly waived — otherwise asking support becomes the free
            way around the off-peak rule. */}
        {quote?.requiresPayment && (
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/50 p-3 text-sm">
            <p className="font-medium text-ink">Peak slot — this change is chargeable</p>
            <p className="mt-1 text-xs text-muted">
              {formatMoney(quote.reclaim)} discount to reclaim + {formatMoney(quote.fee)} fee ={" "}
              <span className="font-medium text-ink">{formatMoney(quote.totalDue)}</span> added to the
              customer's bill.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={waive}
                onChange={(e) => setWaive(e.target.checked)}
                className="mt-0.5 size-4 accent-[color:var(--color-primary,#4F7CFF)]"
              />
              <span className="text-xs text-ink-soft">
                Waive it — move at no extra cost. Recorded against this booking with your name.
              </span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={reschedule.isPending || !date || !slot}>
            {reschedule.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : quote?.requiresPayment && !waive ? (
              `Charge ${formatMoney(quote.totalDue)} & reschedule`
            ) : (
              "Save & Reschedule"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgentCell({ booking }: { booking: AdminBooking }) {
  const { data: agents = [] } = useAgents();
  const assign = useAssignBooking();
  const autoAssign = useAutoAssignBooking();
  const verifiedAgents = agents.filter((a) => a.status === "verified");

  if (booking.status === "cancelled" || booking.status === "completed") {
    return <span className="text-ink-soft">{booking.agentName ?? "—"}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={booking.assignedAgentId ?? ""}
        onChange={(e) => e.target.value && assign.mutate({ id: booking.id, agentId: e.target.value })}
        disabled={assign.isPending}
        className="h-9 rounded-xl border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-primary/50"
      >
        <option value="">{booking.agentName ?? "Unassigned"}</option>
        {verifiedAgents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        title="Auto-assign nearest available agent"
        disabled={autoAssign.isPending}
        onClick={() => autoAssign.mutate(booking.id)}
        className="grid size-8 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        <Wand2 className="size-3.5" />
      </button>
    </div>
  );
}

function StatusCell({ booking }: { booking: AdminBooking }) {
  const setStatus = useSetBookingStatus();

  // A cancelled booking is a dead end, not a draft — the backend refuses to
  // reopen one (its payment may already be queued for refund, its agent
  // offer already released), so the dropdown shouldn't offer to try.
  if (booking.status === "cancelled") {
    return (
      <span
        className={cn(
          "inline-flex h-8 items-center rounded-pill px-2.5 text-xs font-medium",
          BOOKING_STATUS_STYLE[booking.status],
        )}
        title="Cancelled bookings cannot be reopened"
      >
        {BOOKING_STATUS_LABEL.cancelled}
      </span>
    );
  }

  return (
    <select
      value={booking.status}
      onChange={(e) => setStatus.mutate({ id: booking.id, status: e.target.value as BookingStatus })}
      disabled={setStatus.isPending}
      className={cn(
        "h-8 rounded-pill border-none px-2.5 text-xs font-medium outline-none",
        BOOKING_STATUS_STYLE[booking.status],
      )}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const cancelBooking = useCancelBooking();
  const categoryLabel = useCategoryLabel();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [rescheduleBookingTarget, setRescheduleBookingTarget] = useState<AdminBooking | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const list = bookings.filter((b) => {
    const matchesStatus = filter === "all" || b.status === filter;
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      b.customerName.toLowerCase().includes(q) ||
      b.vehicleName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.society.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const paginated = usePagination(list, 10);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = list.filter((b) => {
      const serviceDate = new Date(b.date);
      if (range.from && serviceDate < range.from) return false;
      if (range.to && serviceDate > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((b) => ({
        "Booking ID": b.id,
        Vehicle: b.vehicleName,
        Category: categoryLabel(b.vehicleType),
        Customer: b.customerName,
        Date: formatDate(b.date),
        Slot: b.slot,
        Society: b.society,
        Agent: b.agentName ?? "",
        Status: BOOKING_STATUS_LABEL[b.status],
        "Amount (₹)": b.price,
      })),
      `nexclean-bookings-${new Date().toISOString().slice(0, 10)}`,
      "Bookings",
    );
  };

  return (
    <div className="space-y-6">
      {rescheduleBookingTarget && (
        <RescheduleModal
          booking={rescheduleBookingTarget}
          onClose={() => setRescheduleBookingTarget(null)}
        />
      )}

      {showExportModal && (
        <ExportDateRangeModal
          title="Export Bookings"
          description="Choose a service-date range to export, or leave blank to export every booking currently matching your filters."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Bookings</h1>
          <p className="mt-1 text-muted">{bookings.length} total · assign agents, reschedule & control status.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportModal(true)}
          disabled={list.length === 0}
          className="shrink-0"
        >
          <FileSpreadsheet className="size-4" /> Export Excel
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search bookings…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Booking</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">When</th>
              <th className="px-2 py-2 font-medium">Society</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
              <th className="px-2 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows rows={6} cols={8} />}
            {!isLoading && paginated.pageItems.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <Link
                    to={`/admin/bookings/${b.id}`}
                    className="font-medium text-ink hover:text-primary transition-colors block"
                    data-testid={`booking-link-${b.id}`}
                  >
                    {b.vehicleName}
                  </Link>
                  <p className="text-xs text-muted">
                    {categoryLabel(b.vehicleType)} · <Link to={`/admin/bookings/${b.id}`} className="hover:underline hover:text-primary">#{b.id}</Link>
                  </p>
                  {b.offPeakLocked && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                      title={`Discounted ${formatMoney(b.offPeakDiscountAmount)} for booking off-peak — moving to a peak slot is chargeable`}
                    >
                      Off-peak {formatMoney(b.offPeakDiscountAmount)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-ink-soft">{b.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)} · {b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">{b.society}</td>
                <td className="px-2 py-3">
                  <AgentCell booking={b} />
                </td>
                <td className="px-2 py-3">
                  <StatusCell booking={b} />
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(b.price)}</td>
                <td className="px-2 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/admin/bookings/${b.id}`}>
                      <Button variant="ghost" size="sm" title="View booking details and live tracking" data-testid={`view-booking-${b.id}`}>
                        <Eye className="size-3.5" /> Details
                      </Button>
                    </Link>
                    {b.status === "upcoming" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduleBookingTarget(b)}
                        title="Reschedule Booking"
                      >
                        <Calendar className="size-3.5" /> Reschedule
                      </Button>
                    )}
                    {(b.status === "upcoming" || b.status === "in_progress") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancelBooking.isPending}
                        onClick={() => cancelBooking.mutate(b.id)}
                      >
                        <X className="size-4" /> Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-12 text-center text-muted">
                  No bookings match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          onPageChange={paginated.setPage}
        />
      </GlassCard>
    </div>
  );
}
