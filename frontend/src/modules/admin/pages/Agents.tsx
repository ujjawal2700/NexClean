import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Star,
  MapPin,
  BadgeCheck,
  Ban,
  RotateCcw,
  CreditCard,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { usePagination } from "@shared/lib/usePagination";
import { shortId, formatDate } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import {
  useAgents,
  useSetAgentStatus,
  useCreateAgent,
  useUpdateAgent,
  useUpdateAgentArea,
  useDeleteAgent,
} from "../api/admin.api";
import {
  PersonFormModal,
  ConfirmDeleteModal,
} from "../components/PersonFormModal";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";
import { AGENT_STATUS_STYLE } from "../lib/status";
import type { AdminAgent } from "../types";

const FILTERS: { id: "verified" | "suspended" | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "verified", label: "Verified" },
  { id: "suspended", label: "Suspended" },
];

function AreaEditor({ agent }: { agent: AdminAgent }) {
  const updateAgentArea = useUpdateAgentArea();
  const [editing, setEditing] = useState(false);
  const [area, setArea] = useState(agent.area);

  if (!editing) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-4 text-primary" /> {agent.area || "No area set"}
        <button
          onClick={() => {
            setArea(agent.area);
            setEditing(true);
          }}
          aria-label="Edit area"
          className="ml-auto text-muted hover:text-ink">
          <Pencil className="size-3.5" />
        </button>
      </p>
    );
  }

  const save = () => {
    updateAgentArea.mutate({ id: agent.id, area: area.trim() }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="size-4 shrink-0 text-primary" />
      <input
        value={area}
        onChange={(e) => setArea(e.target.value)}
        placeholder="Area / society"
        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-primary/50"
      />
      <button
        disabled={updateAgentArea.isPending}
        onClick={save}
        aria-label="Save area"
        className="text-emerald-600 disabled:opacity-50">
        <Check className="size-4" />
      </button>
      <button
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="text-muted hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Agents() {
  const { data: agents = [] } = useAgents();
  const setAgentStatus = useSetAgentStatus();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const [filter, setFilter] = useState<"verified" | "suspended" | "all">("all");
  const [query, setQuery] = useState("");

  // null = closed, "new" = create, otherwise the agent being edited.
  const [editing, setEditing] = useState<AdminAgent | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminAgent | null>(null);
  const [formError, setFormError] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  const closeForm = () => {
    setEditing(null);
    setFormError("");
  };
  const closeDelete = () => {
    setDeleting(null);
    setFormError("");
  };

  const verifiedAgents = agents.filter((a) => a.status !== "pending");
  const online = verifiedAgents.filter((a) => a.online).length;

  const q = query.toLowerCase();
  const list = verifiedAgents.filter((a) => {
    const matchesStatus = filter === "all" || a.status === filter;
    const matchesQuery =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q) ||
      a.area.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const paginated = usePagination(list, 9);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = list.filter((a) => {
      const joined = new Date(a.joinedAt);
      if (range.from && joined < range.from) return false;
      if (range.to && joined > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((a) => ({
        Name: a.name,
        Phone: a.phone,
        Email: a.email,
        City: a.city,
        Area: a.area,
        Status: a.status,
        Rating: a.rating,
        "Jobs Done": a.jobsDone,
        Online: a.online ? "Yes" : "No",
        Joined: formatDate(a.joinedAt),
      })),
      `nexclean-agents-${new Date().toISOString().slice(0, 10)}`,
      "Agents",
    );
  };

  return (
    <div className="space-y-6">
      {showExportModal && (
        <ExportDateRangeModal
          title="Export Agents"
          description="Choose a join-date range to export, or leave blank to export every agent currently matching your filters."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Agents</h1>
          <p className="mt-1 text-muted">
            {verifiedAgents.length} specialists · {online} online.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowExportModal(true)}
            disabled={list.length === 0}
          >
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button
            onClick={() => {
              setFormError("");
              setEditing("new");
            }}>
            <Plus className="size-4" /> Add agent
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-white"
                  : "text-muted hover:text-ink",
              )}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <Input
            name="search"
            placeholder="Search agents…"
            leading={<Search className="size-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paginated.pageItems.map((a) => (
          <GlassCard key={a.id} className="flex flex-col">
            <Link
              to={`/admin/agents/${a.id}`}
              className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-semibold text-white">
                {a.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-display font-semibold text-ink hover:text-primary">
                    {a.name}
                  </p>
                  {a.status === "verified" && (
                    <BadgeCheck className="size-4 shrink-0 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted">
                  <span title={a.id}>{shortId(a.id)}</span> · {a.phone}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize",
                  AGENT_STATUS_STYLE[a.status],
                )}>
                {a.status}
              </span>
            </Link>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface/60 p-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 font-display font-semibold text-ink">
                  <Star className="size-3.5 fill-primary text-primary" />{" "}
                  {a.rating > 0 ? Number(a.rating).toFixed(1) : "New"}
                </p>
                <p className="text-[11px] text-muted">Rating</p>
              </div>
              <div>
                <p className="font-display font-semibold text-ink">
                  {a.jobsDone}
                </p>
                <p className="text-[11px] text-muted">Jobs</p>
              </div>
              <div>
                <p
                  className={cn(
                    "font-display font-semibold",
                    a.online ? "text-emerald-600" : "text-muted",
                  )}>
                  {a.online ? "Online" : "Off"}
                </p>
                <p className="text-[11px] text-muted">Now</p>
              </div>
            </div>

            <div className="mt-3">
              <AreaEditor agent={a} />
            </div>

            {(a.aadharFrontUrl || a.aadharBackUrl) && (
              <div className="mt-3 rounded-2xl border border-line bg-surface/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CreditCard className="size-3.5 text-primary" /> Aadhar{" "}
                  {a.aadharNumber || "—"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { label: "Front", url: a.aadharFrontUrl },
                    { label: "Back", url: a.aadharBackUrl },
                  ].map(
                    (doc) =>
                      doc.url && (
                        <a
                          key={doc.label}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl border border-line">
                          <img
                            src={doc.url}
                            alt={`Aadhar ${doc.label}`}
                            className="aspect-[4/3] w-full object-cover"
                          />
                        </a>
                      ),
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line/70 pt-4">
              {/* Names include the agent so they stay unambiguous next to the card's
                  "Edit area" control and across the other cards in the grid. */}
              <Button
                size="sm"
                variant="outline"
                aria-label={`Edit ${a.name}`}
                onClick={() => {
                  setFormError("");
                  setEditing(a);
                }}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Delete ${a.name}`}
                onClick={() => {
                  setFormError("");
                  setDeleting(a);
                }}
                className="text-red-600 hover:border-red-500/40 hover:bg-red-500/10">
                <Trash2 className="size-4" /> Delete
              </Button>
              {a.status === "verified" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setAgentStatus.mutate({ id: a.id, status: "suspended" })
                  }>
                  <Ban className="size-4" /> Suspend
                </Button>
              )}
              {a.status === "suspended" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setAgentStatus.mutate({ id: a.id, status: "verified" })
                  }>
                  <RotateCcw className="size-4" /> Reinstate
                </Button>
              )}
            </div>
          </GlassCard>
        ))}
        {list.length === 0 && (
          <p className="col-span-full py-12 text-center text-muted">
            No agents match your search.
          </p>
        )}
      </div>

      <Pagination
        page={paginated.page}
        totalPages={paginated.totalPages}
        onPageChange={paginated.setPage}
      />

      <PersonFormModal
        open={editing !== null}
        title={editing === "new" ? "Add agent" : "Edit agent"}
        submitLabel={editing === "new" ? "Create agent" : "Save changes"}
        kind="agent"
        initial={editing && editing !== "new" ? editing : undefined}
        pending={createAgent.isPending || updateAgent.isPending}
        error={formError}
        onClose={closeForm}
        onSubmit={(v) => {
          setFormError("");
          const done = {
            onSuccess: closeForm,
            onError: (e: unknown) =>
              setFormError((e as Error)?.message ?? "Something went wrong"),
          };
          if (editing === "new") createAgent.mutate(v, done);
          else if (editing) updateAgent.mutate({ id: editing.id, ...v }, done);
        }}
      />

      <ConfirmDeleteModal
        open={deleting !== null}
        kind="agent"
        name={deleting?.name ?? ""}
        pending={deleteAgent.isPending}
        error={formError}
        onClose={closeDelete}
        onDeleteAgentOnly={() => {
          if (!deleting) return;
          setFormError("");
          deleteAgent.mutate(
            { id: deleting.id, mode: "agent_only" },
            {
              onSuccess: closeDelete,
              onError: (e: unknown) =>
                setFormError(
                  (e as Error)?.message ?? "Couldn't delete this agent",
                ),
            },
          );
        }}
        onDeleteWithData={() => {
          if (!deleting) return;
          setFormError("");
          deleteAgent.mutate(
            { id: deleting.id, mode: "with_data" },
            {
              onSuccess: closeDelete,
              onError: (e: unknown) =>
                setFormError(
                  (e as Error)?.message ??
                    "Couldn't delete this agent with data",
                ),
            },
          );
        }}
      />
    </div>
  );
}
