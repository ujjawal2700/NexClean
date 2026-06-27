import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Star, BadgeCheck, Ban, RotateCcw, CreditCard, Eye, EyeOff } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { useAgent, useAgentActivity, useSetAgentStatus, useCategoryLabel } from "../api/admin.api";
import { AGENT_STATUS_STYLE, BOOKING_STATUS_STYLE, BOOKING_STATUS_LABEL } from "../lib/status";

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent } = useAgent(id ?? "");
  const { data: activity } = useAgentActivity(id ?? "");
  const setAgentStatus = useSetAgentStatus();
  const categoryLabel = useCategoryLabel();
  const bookings = usePagination(activity?.bookings ?? [], 5);
  const [showDocs, setShowDocs] = useState(false);

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
              <MapPin className="size-3.5" /> {agent.area || "No area set"}
            </span>
            <span>Joined {formatDate(agent.joinedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {agent.status === "pending" && (
            <Button size="sm" onClick={() => setAgentStatus.mutate({ id: agent.id, status: "verified" })}>
              <BadgeCheck className="size-4" /> Verify
            </Button>
          )}
          {agent.status === "verified" && (
            <Button size="sm" variant="outline" onClick={() => setAgentStatus.mutate({ id: agent.id, status: "suspended" })}>
              <Ban className="size-4" /> Suspend
            </Button>
          )}
          {agent.status === "suspended" && (
            <Button size="sm" variant="outline" onClick={() => setAgentStatus.mutate({ id: agent.id, status: "verified" })}>
              <RotateCcw className="size-4" /> Reinstate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <GlassCard>
          <p className="text-sm text-muted">Rating</p>
          <p className="mt-1.5 flex items-center gap-1 font-display text-2xl font-semibold text-ink">
            <Star className="size-4 fill-primary text-primary" /> {agent.rating}
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
                  <p className="font-medium text-ink">{b.packageName}</p>
                  <p className="text-xs text-muted">#{b.id}</p>
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
    </div>
  );
}
