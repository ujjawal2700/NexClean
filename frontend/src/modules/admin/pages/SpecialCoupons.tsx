import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles, Search, RotateCcw, UserPlus, Clock, FileSpreadsheet } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import { usePagination } from "@shared/lib/usePagination";
import {
  useSpecialCoupons,
  useGenerateSpecialCoupons,
  useAssignSpecialCoupon,
  useToggleSpecialCouponActive,
  useReactivateSpecialCoupon,
  useCustomers,
} from "../api/admin.api";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";
import type { DiscountType, SpecialCoupon } from "../types";

function discountLabel(coupon: Pick<SpecialCoupon, "type" | "value" | "maxDiscount" | "minOrderValue">) {
  const base = coupon.type === "percent" ? `${coupon.value}% off` : `${formatMoney(coupon.value)} off`;
  const extras = [
    coupon.type === "percent" && coupon.maxDiscount ? `up to ${formatMoney(coupon.maxDiscount)}` : null,
    coupon.minOrderValue ? `min order ${formatMoney(coupon.minOrderValue)}` : null,
  ].filter(Boolean);
  return extras.length ? `${base} · ${extras.join(" · ")}` : base;
}

function statusBadgeClass(status: SpecialCoupon["status"]) {
  if (status === "used") return "border-line/70 bg-surface-muted text-muted";
  if (status === "inactive") return "border-red-500/20 bg-red-500/10 text-red-500";
  return "border-primary/15 bg-primary/8 text-primary";
}

function GenerateCouponsSection() {
  const generate = useGenerateSpecialCoupons();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("10");
  const [type, setType] = useState<DiscountType>("percent");
  const [value, setValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTill, setValidTill] = useState("");
  const [offPeakOnly, setOffPeakOnly] = useState(false);

  const reset = () => {
    setCount("10");
    setValue("");
    setMinOrderValue("");
    setMaxDiscount("");
    setValidFrom("");
    setValidTill("");
    setOffPeakOnly(false);
  };

  const submit = () => {
    const n = Number(count);
    if (!n || n < 1 || !value) return;
    generate.mutate(
      {
        count: n,
        type,
        value: Number(value),
        minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
        validTill: validTill ? new Date(validTill).toISOString() : undefined,
        offPeakOnly,
      },
      { onSuccess: () => { reset(); setOpen(false); } },
    );
  };

  return (
    <GlassCard className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">Special Coupons</p>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" /> Generate coupons
        </Button>
      </div>
      <p className="text-sm text-muted">
        Generate a batch of one-time, auto-coded coupons and gift them to specific customers. Each coupon can
        only be redeemed by the customer it's assigned to, and only once.
      </p>

      {open && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              name="count"
              type="number"
              min={1}
              max={500}
              placeholder="How many coupons?"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DiscountType)}
              className="h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
            >
              <option value="percent">% off</option>
              <option value="flat">₹ flat off</option>
            </select>
            <Input
              name="value"
              type="number"
              placeholder={type === "percent" ? "e.g. 20" : "e.g. 100"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Input
              name="minOrderValue"
              type="number"
              placeholder="Min order (optional)"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
            />
            {type === "percent" && (
              <Input
                name="maxDiscount"
                type="number"
                placeholder="Max discount cap (optional)"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
              />
            )}
            <Input
              name="validFrom"
              type="date"
              placeholder="Available from"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
            <Input
              name="validTill"
              type="date"
              placeholder="Available till"
              value={validTill}
              onChange={(e) => setValidTill(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3">
            <input
              type="checkbox"
              checked={offPeakOnly}
              onChange={(e) => setOffPeakOnly(e.target.checked)}
              className="mt-0.5 size-4 accent-[color:var(--color-primary,#4F7CFF)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Clock className="size-3.5 text-primary" /> Off-peak hours only
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Every coupon in this batch will apply only when the booking's time slot falls inside a
                window set on the{" "}
                <Link to="/admin/off-peak-hours" className="text-primary hover:underline">
                  Off-Peak Hours
                </Link>{" "}
                page.
              </span>
            </span>
          </label>
          <Button size="sm" onClick={submit} disabled={generate.isPending || !count || !value}>
            {generate.isPending ? "Generating…" : `Generate ${count || 0} coupon(s)`}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

function AssignPanel({ coupon }: { coupon: SpecialCoupon }) {
  const { data: customers = [] } = useCustomers();
  const assign = useAssignSpecialCoupon();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, query]);

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          name={`assign-${coupon.id}`}
          placeholder="Search customer by name, phone, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      {matches.length > 0 && (
        <div className="space-y-1 rounded-xl border border-line bg-surface/80 p-1.5">
          {matches.map((c) => (
            <button
              key={c.id}
              onClick={() => assign.mutate({ id: coupon.id, customerId: c.id })}
              disabled={assign.isPending}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-muted"
            >
              <span className="font-medium text-ink">{c.name}</span>
              <span className="text-xs text-muted">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && matches.length === 0 && <p className="px-1 text-xs text-muted">No customers match.</p>}
    </div>
  );
}

function CouponRow({ coupon }: { coupon: SpecialCoupon }) {
  const toggleActive = useToggleSpecialCouponActive();
  const reactivate = useReactivateSpecialCoupon();
  const [assigning, setAssigning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const unassigned = !coupon.assignedCustomer;

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold text-ink">{coupon.code}</p>
            <Badge className={statusBadgeClass(coupon.status)}>{coupon.status}</Badge>
            {coupon.offPeakOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                <Clock className="size-3" /> Off-peak only
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {discountLabel(coupon)}
            {coupon.validTill ? ` · valid till ${new Date(coupon.validTill).toLocaleDateString("en-IN")}` : ""}
          </p>
          <p className="text-xs text-muted">
            {coupon.assignedCustomer
              ? `Assigned to ${coupon.assignedCustomer.name} · ${coupon.assignedCustomer.phone}`
              : "Unassigned"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {unassigned && coupon.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => setAssigning((v) => !v)}>
              <UserPlus className="size-4" /> Assign
            </Button>
          )}
          {coupon.status === "used" && (
            <>
              {coupon.usageHistory.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                  History
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={reactivate.isPending}
                onClick={() => reactivate.mutate(coupon.id)}
              >
                <RotateCcw className="size-4" /> Reactivate
              </Button>
            </>
          )}
          {coupon.status !== "used" && (
            <Button
              variant="outline"
              size="sm"
              disabled={toggleActive.isPending}
              onClick={() => toggleActive.mutate({ id: coupon.id, active: coupon.status !== "active" })}
            >
              {coupon.status === "active" ? "Active" : "Inactive"}
            </Button>
          )}
        </div>
      </div>

      {assigning && unassigned && coupon.status === "active" && <AssignPanel coupon={coupon} />}

      {showHistory && coupon.usageHistory.length > 0 && (
        <div className="mt-2 space-y-1 rounded-xl border border-line bg-surface/80 p-2.5 text-xs text-muted">
          {coupon.usageHistory.map((h, i) => (
            <p key={i}>
              Used {new Date(h.usedAt).toLocaleString("en-IN")} · discount {formatMoney(h.discountAmount)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function CouponBatches() {
  const { data: coupons = [], isLoading } = useSpecialCoupons();

  const batches = useMemo(() => {
    const map = new Map<string, SpecialCoupon[]>();
    for (const c of coupons) {
      const list = map.get(c.batchId) ?? [];
      list.push(c);
      map.set(c.batchId, list);
    }
    return Array.from(map.entries());
  }, [coupons]);

  const paginated = usePagination(batches, 5);

  if (isLoading) return <p className="text-sm text-muted">Loading coupons…</p>;
  if (batches.length === 0) return <p className="text-sm text-muted">No special coupons yet. Generate a batch above.</p>;

  return (
    <div className="space-y-5">
      {paginated.pageItems.map(([batchId, batch]) => (
        <GlassCard key={batchId} className="space-y-3">
          <p className="text-sm font-semibold text-ink">
            Batch of {batch.length} · generated {new Date(batch[0].createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <div className="space-y-2">
            {batch.map((c) => (
              <CouponRow key={c.id} coupon={c} />
            ))}
          </div>
        </GlassCard>
      ))}
      <Pagination
        page={paginated.page}
        totalPages={paginated.totalPages}
        onPageChange={paginated.setPage}
      />
    </div>
  );
}

export function SpecialCoupons() {
  // React Query dedupes this against CouponBatches' own useSpecialCoupons()
  // call — not an extra request — so the export button can sit up here at
  // the page level without CouponBatches needing to expose its data.
  const { data: coupons = [] } = useSpecialCoupons();
  const [showExportModal, setShowExportModal] = useState(false);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = coupons.filter((c) => {
      const created = new Date(c.createdAt);
      if (range.from && created < range.from) return false;
      if (range.to && created > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((c) => ({
        Code: c.code,
        Type: c.type === "percent" ? "% off" : "₹ flat off",
        Value: c.value,
        "Min Order (₹)": c.minOrderValue,
        "Max Discount (₹)": c.maxDiscount ?? "",
        "Valid From": c.validFrom ? formatDate(c.validFrom) : "",
        "Valid Till": c.validTill ? formatDate(c.validTill) : "",
        Status: c.status,
        "Assigned Customer": c.assignedCustomer?.name ?? "",
        "Assigned Phone": c.assignedCustomer?.phone ?? "",
        "Batch ID": c.batchId,
        "Off-Peak Only": c.offPeakOnly ? "Yes" : "No",
        Created: formatDate(c.createdAt),
      })),
      `nexclean-special-coupons-${new Date().toISOString().slice(0, 10)}`,
      "Special Coupons",
    );
  };

  return (
    <div className="space-y-8">
      {showExportModal && (
        <ExportDateRangeModal
          title="Export Special Coupons"
          description="Choose a created-date range to export, or leave blank to export every special coupon."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Special Coupons</h1>
          <p className="mt-1 text-muted">
            Generate one-time, auto-coded coupons and gift them to specific customers — separate from the shared
            discount codes managed under Coupon &amp; Promotions.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowExportModal(true)} disabled={coupons.length === 0} className="shrink-0">
          <FileSpreadsheet className="size-4" /> Export Excel
        </Button>
      </div>

      <GenerateCouponsSection />
      <CouponBatches />
    </div>
  );
}
