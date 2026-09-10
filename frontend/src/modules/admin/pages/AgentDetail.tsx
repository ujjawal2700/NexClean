import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Star, BadgeCheck, Ban, RotateCcw, CreditCard, Eye, EyeOff, Pencil, Trash2, Radio } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate, shortId } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import {
  useAgent,
  useAgentActivity,
  useSetAgentStatus,
  useCategoryLabel,
  useUpdateAgent,
  useDeleteAgent,
} from "../api/admin.api";
import { PersonFormModal, ConfirmDeleteModal, ConfirmActionModal } from "../components/PersonFormModal";
import { AgentLocationModal } from "../components/AgentLocationModal";
import { AgentLiveLocationSection } from "../components/AgentLiveLocationSection";
import { AGENT_STATUS_STYLE, BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL } from "../lib/status";

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent } = useAgent(id ?? "");
  const { data: activity } = useAgentActivity(id ?? "");
  const setAgentStatus = useSetAgentStatus();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const categoryLabel = useCategoryLabel();
  const bookings = usePagination(activity?.bookings ?? [], 5);
  const [showDocs, setShowDocs] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [formError, setFormError] = useState("");
  // Pending verification change, held until the admin confirms it.
  const [statusChange, setStatusChange] = useState<"verified" | "pending" | "suspended" | null>(null);

  if (!agent) return null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/admin/agents")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to agents
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-lg font-semibold text-white">
          {agent.name.split(" ").map((n) => n[0]).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-ink">{agent.name}</h1>
            {agent.status === "verified" && <BadgeCheck className="size-5 text-primary" />}
            <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", AGENT_STATUS_STYLE[agent.status])}>
              {agent.status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {agent.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {[agent.city, agent.area].filter(Boolean).join(" · ") || "No location set"}
            </span>
            <span>Joined {formatDate(agent.joinedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setTrackingLocation(true)}>
            <Radio className="size-4" /> Live location
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setFormError(""); setEditing(true); }}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setFormError(""); setDeleting(true); }}
            className="text-red-600 hover:border-red-500/40 hover:bg-red-500/10"
          >
            <Trash2 className="size-4" /> Delete
          </Button>
          {/* Every status change goes through a confirmation — these sit next to
              each other in one toolbar, and suspending ends the cleaner's live
              sessions and drops them out of dispatch immediately. */}
          {agent.status !== "verified" && (
            <Button size="sm" onClick={() => { setFormError(""); setStatusChange("verified"); }}>
              <BadgeCheck className="size-4" /> {agent.status === "suspended" ? "Reinstate" : "Verify"}
            </Button>
          )}
          {agent.status === "verified" && (
            <Button size="sm" variant="outline" onClick={() => { setFormError(""); setStatusChange("pending"); }}>
              <RotateCcw className="size-4" /> Move to pending
            </Button>
          )}
          {agent.status !== "suspended" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setFormError(""); setStatusChange("suspended"); }}
              className="text-red-600 hover:border-red-500/40 hover:bg-red-500/10"
            >
              <Ban className="size-4" /> Suspend
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <GlassCard>
          <p className="text-sm text-muted">Rating</p>
          <p className="mt-1.5 flex items-center gap-1 font-display text-2xl font-semibold text-ink">
            <Star className="size-4 fill-primary text-primary" /> {agent.rating > 0 ? Number(agent.rating).toFixed(1) : "New"}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Jobs done</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{agent.jobsDone}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Bookings assigned</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{agent.totalBookings}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Completed / cancelled</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">
            {agent.completedJobs} / {agent.cancelledJobs}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-muted">Revenue generated</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{formatMoney(agent.totalEarnings)}</p>
        </GlassCard>
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Verification</p>
          <p className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
            {agent.status === "verified" ? (
              <>
                <BadgeCheck className="size-5 text-primary" /> Verified
              </>
            ) : agent.status === "suspended" ? (
              <>
                <Ban className="size-5 text-red-500" /> Suspended
              </>
            ) : (
              <>
                <RotateCcw className="size-5 text-amber-500" /> {agent.status === "pending" ? "Pending review" : "Unverified"}
              </>
            )}
          </p>
        </div>
        <p className="max-w-md text-sm text-muted">
          {agent.status === "verified"
            ? "This agent can receive dispatch offers and take jobs."
            : agent.status === "suspended"
              ? "Signed out of every device and blocked from signing in. No dispatch offers."
              : "Cannot take jobs until verified. Review the KYC documents below, then verify."}
        </p>
      </GlassCard>

      <AgentLiveLocationSection
        agentId={agent.id}
        agentName={agent.name}
        city={agent.city}
        area={agent.area}
        onOpenModal={() => setTrackingLocation(true)}
      />

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-ink">
            <CreditCard className="size-4 text-primary" /> KYC documents · Aadhar {agent.aadharNumber || "Not provided"}
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowDocs((v) => !v)}>
            {showDocs ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showDocs ? "Hide" : "View"}
          </Button>
        </div>

        {!showDocs ? (
          <p className="mt-4 text-sm text-muted">Documents are hidden. Click "View" to reveal the agent's KYC images.</p>
        ) : agent.aadharFrontUrl || agent.aadharBackUrl ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Front", url: agent.aadharFrontUrl },
              { label: "Back", url: agent.aadharBackUrl },
            ].map((doc) =>
              doc.url ? (
                <a
                  key={doc.label}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-2xl border border-line"
                >
                  <img src={doc.url} alt={`Aadhar ${doc.label}`} className="aspect-[4/3] w-full object-cover" />
                </a>
              ) : (
                <div
                  key={doc.label}
                  className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-line text-sm text-muted"
                >
                  {doc.label} not uploaded
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">This agent hasn't uploaded any KYC documents yet.</p>
        )}
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <p className="font-display text-lg font-semibold text-ink">Service history</p>
        <table className="mt-4 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Booking</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">When</th>
              <th className="px-2 py-2 font-medium">Vehicle</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.pageItems.map((b) => (
              <tr key={b.id} className="border-t border-line/70">
                <td className="px-2 py-3">
                  <Link to={`/admin/bookings/${b.id}`} className="font-medium text-ink hover:text-primary transition-colors block">
                    {b.packageName}
                  </Link>
                  <p className="text-xs text-muted" title={b.id}>
                    <Link to={`/admin/bookings/${b.id}`} className="hover:underline hover:text-primary">#{shortId(b.id)}</Link>
                  </p>
                </td>
                <td className="px-2 py-3 text-ink-soft">{b.customerName}</td>
                <td className="px-2 py-3 text-ink-soft">{formatDate(b.date)} · {b.slot}</td>
                <td className="px-2 py-3 text-ink-soft">
                  {b.vehicleName} · {categoryLabel(b.vehicleType)}
                </td>
                <td className="px-2 py-3">
                  <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", BOOKING_STATUS_STYLE[b.status])}>
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-medium text-ink">{formatMoney(b.price)}</td>
              </tr>
            ))}
            {bookings.pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted">
                  No bookings handled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={bookings.page} totalPages={bookings.totalPages} onPageChange={bookings.setPage} />
      </GlassCard>
      {trackingLocation && (
        <AgentLocationModal
          agentId={agent.id}
          agentName={agent.name}
          onClose={() => setTrackingLocation(false)}
        />
      )}

      <PersonFormModal
        open={editing}
        title="Edit agent"
        submitLabel="Save changes"
        kind="agent"
        initial={agent}
        pending={updateAgent.isPending}
        error={formError}
        onClose={() => { setEditing(false); setFormError(""); }}
        onSubmit={(v) => {
          setFormError("");
          updateAgent.mutate(
            { id: agent.id, ...v },
            {
              onSuccess: () => { setEditing(false); setFormError(""); },
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Something went wrong"),
            },
          );
        }}
      />

      <ConfirmActionModal
        open={statusChange !== null}
        title={
          statusChange === "suspended"
            ? "Suspend this agent?"
            : statusChange === "verified"
              ? "Verify this agent?"
              : "Move back to pending?"
        }
        description={
          statusChange === "suspended" ? (
            <>
              <span className="font-medium text-ink">{agent.name}</span> will be signed out of every device and blocked
              from signing in. Any job already assigned to them stays assigned — reassign it from the booking if needed.
            </>
          ) : statusChange === "verified" ? (
            <>
              <span className="font-medium text-ink">{agent.name}</span> will be able to sign in and start receiving
              dispatch offers immediately. Check the KYC documents first if you haven't.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{agent.name}</span> will stop receiving dispatch offers until they
              are verified again. They can still sign in.
            </>
          )
        }
        confirmLabel={statusChange === "suspended" ? "Suspend" : statusChange === "verified" ? "Verify" : "Move to pending"}
        destructive={statusChange === "suspended"}
        pending={setAgentStatus.isPending}
        error={formError}
        onClose={() => { setStatusChange(null); setFormError(""); }}
        onConfirm={() => {
          if (!statusChange) return;
          setFormError("");
          setAgentStatus.mutate(
            { id: agent.id, status: statusChange },
            {
              onSuccess: () => setStatusChange(null),
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Couldn't change the status"),
            },
          );
        }}
      />

      <ConfirmDeleteModal
        open={deleting}
        kind="agent"
        name={agent.name}
        pending={deleteAgent.isPending}
        error={formError}
        onClose={() => { setDeleting(false); setFormError(""); }}
        onDeleteAgentOnly={() => {
          setFormError("");
          deleteAgent.mutate(
            { id: agent.id, mode: "agent_only" },
            {
              // The record this page is built on is gone, so go back to the list
              // rather than leaving a detail view of something that no longer exists.
              onSuccess: () => navigate("/admin/agents"),
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Couldn't delete this agent"),
            },
          );
        }}
        onDeleteWithData={() => {
          setFormError("");
          deleteAgent.mutate(
            { id: agent.id, mode: "with_data" },
            {
              onSuccess: () => navigate("/admin/agents"),
              onError: (e: unknown) => setFormError((e as Error)?.message ?? "Couldn't delete this agent with data"),
            },
          );
        }}
      />
    </div>
  );
}
