import { useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Calendar,
  Trash2,
  Search,
  Users,
  Loader2,
  Rocket,
  Download,
  CheckCircle2,
  PhoneCall,
  Clock,
  ChevronDown,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { usePagination } from "@shared/lib/usePagination";
import { useLeads, useDeleteLead, useUpdateLeadStatus } from "../api/admin.api";
import type { Lead } from "../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Quote a value for CSV, neutralising spreadsheet formula injection.
 *
 * Leads come from a PUBLIC, unauthenticated endpoint with free-form name/city/
 * location, and Excel and Sheets execute any cell whose text begins with
 * =, +, -, @, tab or CR — quoting alone does not stop it. So a stranger could
 * submit a "lead" called =HYPERLINK(...) (or worse) and have it run on an
 * admin's machine the moment they exported and opened this file. Prefixing a
 * single quote makes the spreadsheet treat it as literal text.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const dangerous = /^[=+\-@\t\r]/.test(text);
  return `"${(dangerous ? `'${text}` : text).replace(/"/g, '""')}"`;
}

/** Function to trigger Excel (.csv) file download for leads */
function exportLeadsToExcel(leadsList: Lead[]) {
  if (!leadsList || leadsList.length === 0) return;

  const headers = [
    "S.No",
    "Full Name",
    "Mobile Number",
    "Email Address",
    "City",
    "Location / Area",
    "Status",
    "Submitted Date",
  ];

  const rows = leadsList.map((l, index) => [
    csvCell(index + 1),
    csvCell(l.name),
    csvCell(l.phone),
    csvCell(l.email || "-"),
    csvCell(l.city),
    csvCell(l.location || "-"),
    csvCell(l.status === "contacted" ? "Contacted" : l.status === "converted" ? "Converted" : "New"),
    csvCell(formatDate(l.createdAt)),
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];

  link.href = url;
  link.setAttribute("download", `NexClean_Leads_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function LeadCard({
  lead,
  onDelete,
  onUpdateStatus,
}: {
  lead: Lead;
  onDelete: () => void;
  onUpdateStatus: (status: "new" | "contacted" | "converted") => void;
}) {
  const [updating, setUpdating] = useState(false);
  const status = lead.status || "new";

  const handleStatusChange = (newStatus: "new" | "contacted" | "converted") => {
    if (newStatus === status) return;
    setUpdating(true);
    onUpdateStatus(newStatus);
    setTimeout(() => setUpdating(false), 600);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {/* Avatar badge based on status */}
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
            status === "converted"
              ? "bg-emerald-500/10 text-emerald-600"
              : status === "contacted"
              ? "bg-blue-500/10 text-blue-600"
              : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {status === "converted" ? (
            <CheckCircle2 className="size-5" />
          ) : status === "contacted" ? (
            <PhoneCall className="size-5" />
          ) : (
            <Clock className="size-5" />
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-ink text-base">{lead.name}</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                status === "converted"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : status === "contacted"
                  ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                  : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              }`}
            >
              {status === "converted"
                ? "Converted"
                : status === "contacted"
                ? "Contacted"
                : "New"}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1 font-medium text-ink">
              <Phone className="size-3 text-primary" /> {lead.phone}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3" /> {lead.email}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="size-3 text-amber-500" /> {lead.city}
              {lead.location && ` (${lead.location})`}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {formatDate(lead.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line/60 pt-3 sm:border-0 sm:pt-0">
        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={status}
            onChange={(e) =>
              handleStatusChange(
                e.target.value as "new" | "contacted" | "converted",
              )
            }
            disabled={updating}
            className={`appearance-none rounded-xl border px-3 py-1.5 pr-8 text-xs font-semibold outline-none cursor-pointer transition-colors ${
              status === "converted"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : status === "contacted"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700"
            }`}
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 opacity-60" />
        </div>

        <button
          onClick={onDelete}
          title="Delete lead"
          className="flex size-8 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Leads() {
  const { data: leads = [], isLoading } = useLeads();
  const deleteLead = useDeleteLead();
  const updateStatus = useUpdateLeadStatus();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "new" | "contacted" | "converted">("all");

  const newLeadsCount = leads.filter((l) => !l.status || l.status === "new").length;
  const contactedLeadsCount = leads.filter((l) => l.status === "contacted").length;
  const convertedLeadsCount = leads.filter((l) => l.status === "converted").length;

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.city.toLowerCase().includes(q) ||
      (l.location && l.location.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const leadStatus = l.status || "new";
    if (activeTab === "new") return leadStatus === "new";
    if (activeTab === "contacted") return leadStatus === "contacted";
    if (activeTab === "converted") return leadStatus === "converted";
    return true;
  });

  const paginated = usePagination(filtered, 10);

  // Group by city from paginated items
  const byCityMap = new Map<string, Lead[]>();
  for (const lead of paginated.pageItems) {
    const existing = byCityMap.get(lead.city) ?? [];
    existing.push(lead);
    byCityMap.set(lead.city, existing);
  }
  const byCityEntries = Array.from(byCityMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            Manage interest submissions from users in unserviced areas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportLeadsToExcel(leads)}
            disabled={leads.length === 0}
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
          >
            <Download className="size-4" /> Export Excel
          </Button>

          <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5">
            <Rocket className="size-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{leads.length}</p>
            <p className="text-xs text-muted">Total leads</p>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Clock className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{newLeadsCount}</p>
            <p className="text-xs text-muted">Awaiting contact</p>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
            <PhoneCall className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{contactedLeadsCount}</p>
            <p className="text-xs text-muted">Contacted</p>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <CheckCircle2 className="size-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{convertedLeadsCount}</p>
            <p className="text-xs text-muted">Converted</p>
          </div>
        </GlassCard>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: `All (${leads.length})` },
              { key: "new", label: `New (${newLeadsCount})` },
              { key: "contacted", label: `Contacted (${contactedLeadsCount})` },
              { key: "converted", label: `Converted (${convertedLeadsCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-muted/60 text-ink-soft hover:bg-surface-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <Input
            name="lead-search"
            placeholder="Search by name, phone, city…"
            leading={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted">
          <Loader2 className="size-5 animate-spin" /> Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <Rocket className="size-8 text-amber-400" />
          </div>
          <p className="font-semibold text-ink">No leads yet</p>
          <p className="text-sm text-muted">
            When users from unserviced cities sign up, they'll appear here.
          </p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No leads match your search/filter.</p>
      ) : (
        <div className="space-y-6">
          {byCityEntries.map(([city, cityLeads]) => (
            <div key={city}>
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-amber-500" />
                <p className="text-sm font-semibold text-ink">{city}</p>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {cityLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {cityLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDelete={() => deleteLead.mutate(lead.id)}
                    onUpdateStatus={(newStatus) =>
                      updateStatus.mutate({ id: lead.id, status: newStatus })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          <Pagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            onPageChange={paginated.setPage}
          />
        </div>
      )}
    </div>
  );
}
