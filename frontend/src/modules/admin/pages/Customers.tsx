import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Pagination } from "@shared/ui/Pagination";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import { usePagination } from "@shared/lib/usePagination";
import {
  useCustomers,
  usePlans,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from "../api/admin.api";
import { PersonFormModal, ConfirmDeleteModal } from "../components/PersonFormModal";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";
import { CUSTOMER_STATUS_STYLE } from "../lib/status";
import type { CustomerStatus, AdminCustomer } from "../types";

const STATUS_FILTERS: { id: CustomerStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
];

export function Customers() {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: plans = [] } = usePlans();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  // null = closed, "new" = create, otherwise the customer being edited.
  const [editing, setEditing] = useState<AdminCustomer | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminCustomer | null>(null);
  const [formError, setFormError] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  const closeForm = () => { setEditing(null); setFormError(""); };
  const closeDelete = () => { setDeleting(null); setFormError(""); };

  const planLabel = (planId: string | null) => {
    if (!planId) return "—";
    return plans.find((p) => p.id === planId)?.name ?? planId;
  };

  const planFilters = [{ id: "all", label: "All" }, { id: "none", label: "None" }, ...plans.map((p) => ({ id: p.id, label: p.name }))];

  const q = query.toLowerCase();
  const list = customers.filter((c) => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesPlan = planFilter === "all" || (planFilter === "none" ? !c.activePlan : c.activePlan === planFilter);
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    return matchesStatus && matchesPlan && matchesQuery;
  });

  const paginated = usePagination(list, 10);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = list.filter((c) => {
      const joined = new Date(c.joinedAt);
      if (range.from && joined < range.from) return false;
      if (range.to && joined > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((c) => ({
        Name: c.name,
        Phone: c.phone,
        Email: c.email,
        Joined: formatDate(c.joinedAt),
        Status: c.status,
        Plan: planLabel(c.activePlan),
        Bookings: c.totalBookings,
        "Total Spend (₹)": c.totalSpend,
      })),
      `nexclean-customers-${new Date().toISOString().slice(0, 10)}`,
      "Customers",
    );
  };

  return (
    <div className="space-y-6">
      {showExportModal && (
        <ExportDateRangeModal
          title="Export Customers"
          description="Choose a signup-date range to export, or leave blank to export every customer currently matching your filters."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Customers</h1>
          <p className="mt-1 text-muted">{customers.length} registered · manage and review activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowExportModal(true)}
            disabled={list.length === 0}
          >
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button onClick={() => { setFormError(""); setEditing("new"); }}>
            <Plus className="size-4" /> Add customer
          </Button>
        </div>
      </div>

      <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-5">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Status</p>
            <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                    statusFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Plan</p>
            <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
              {planFilters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPlanFilter(f.id)}
                  className={cn(
                    "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                    planFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search customers…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Phone</th>
              <th className="px-2 py-2 font-medium">Joined</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Plan</th>
              <th className="px-2 py-2 text-right font-medium">Bookings</th>
              <th className="px-2 py-2 text-right font-medium">Total spend</th>
              <th className="px-2 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows rows={6} cols={8} />}
            {!isLoading && paginated.pageItems.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/customers/${c.id}`)}
                className="cursor-pointer border-t border-line/70 transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{c.email || "No email"}</p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{c.phone}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(c.joinedAt)}</td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", CUSTOMER_STATUS_STYLE[c.status])}>
                    {c.status}
                  </span>
                </td>
                <td className="px-2 py-3 text-ink-soft">{planLabel(c.activePlan)}</td>
                <td className="px-2 py-3 text-right text-ink-soft">{c.totalBookings}</td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(c.totalSpend)}</td>
                {/* Stop propagation so acting on a row doesn't also open its detail page. */}
                <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => { setFormError(""); setEditing(c); }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => { setFormError(""); setDeleting(c); }}
                      className="text-red-600 hover:border-red-500/40 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-12 text-center text-muted">
                  No customers match your filters.
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

      <PersonFormModal
        kind="customer"
        open={editing !== null}
        title={editing === "new" ? "Add customer" : "Edit customer"}
        submitLabel={editing === "new" ? "Create customer" : "Save changes"}
        initial={editing && editing !== "new" ? editing : undefined}
        pending={createCustomer.isPending || updateCustomer.isPending}
        error={formError}
        onClose={closeForm}
        onSubmit={(v) => {
          setFormError("");
          const done = { onSuccess: closeForm, onError: (e: unknown) => setFormError((e as Error)?.message ?? "Something went wrong") };
          if (editing === "new") createCustomer.mutate(v, done);
          else if (editing) updateCustomer.mutate({ id: editing.id, ...v }, done);
        }}
      />

      <ConfirmDeleteModal
        open={deleting !== null}
        kind="customer"
        name={deleting?.name ?? ""}
        pending={deleteCustomer.isPending}
        error={formError}
        onClose={closeDelete}
        onDeleteCustomerOnly={() => {
          if (!deleting) return;
          setFormError("");
          deleteCustomer.mutate(
            { id: deleting.id, mode: "customer_only" },
            {
              onSuccess: closeDelete,
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Couldn't delete this customer"),
            },
          );
        }}
        onDeleteWithData={() => {
          if (!deleting) return;
          setFormError("");
          deleteCustomer.mutate(
            { id: deleting.id, mode: "with_data" },
            {
              onSuccess: closeDelete,
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Couldn't delete this customer with data"),
            },
          );
        }}
      />
    </div>
  );
}
