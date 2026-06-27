import { useState } from "react";
import {
  Gift, Users, BadgePercent, Search, Calendar, Phone, ArrowRight,
  TrendingUp, CheckCircle2, Award, Loader2, Sparkles,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { useReferralLogs } from "../api/admin.api";
import { cn } from "@shared/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Referrals() {
  const { data: logs = [], isLoading } = useReferralLogs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      log.referrerName.toLowerCase().includes(q) ||
      log.referrerPhone.includes(q) ||
      log.referrerCode.toLowerCase().includes(q) ||
      log.refereeName.toLowerCase().includes(q) ||
      log.refereePhone.includes(q);

    const matchesStatus = statusFilter === "all" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const subscribedCount = logs.filter((l) => l.status === "Subscribed").length;
  const cleansDoneCount = logs.filter((l) => l.status === "First Clean Done").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Referral Logs</h1>
          <p className="mt-1 text-sm text-muted">
            Track user invitation logs, referral codes, and conversion milestones.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {logs.length} Total Logs
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{logs.length}</p>
            <p className="text-xs text-muted">Total Invitations</p>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-green-500/10 text-green-600">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{cleansDoneCount}</p>
            <p className="text-xs text-muted">First Clean Completed</p>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
            <Award className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink">{subscribedCount}</p>
            <p className="text-xs text-muted">Active Subscribers</p>
          </div>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            name="referral-search"
            placeholder="Search by name, phone or code…"
            leading={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-12 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50"
          >
            <option value="all">All statuses</option>
            <option value="Joined">Signed Up</option>
            <option value="First Clean Done">First Clean Done</option>
            <option value="Subscribed">Subscribed</option>
          </select>
        </div>
      </div>

      {/* Referral Table / Content */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted">
          <Loader2 className="size-5 animate-spin" /> Loading referral logs…
        </div>
      ) : logs.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Gift className="size-8" />
          </div>
          <p className="font-semibold text-ink">No referral logs found</p>
          <p className="text-sm text-muted">
            Referrals will appear here once customers share their invite codes.
          </p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No referral logs match your search.</p>
      ) : (
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-surface-muted/50 text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4">Referrer (Invited By)</th>
                  <th className="px-6 py-4"></th>
                  <th className="px-6 py-4">Referee (Friend Joined)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-surface-muted/20">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-ink">{log.referrerName}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {log.referrerPhone}
                        </span>
                        <span className="rounded bg-primary/5 px-1.5 py-0.5 font-mono text-primary border border-primary/10">
                          {log.referrerCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ArrowRight className="size-4 text-muted/60 inline" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-ink">{log.refereeName}</div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted">
                        <Phone className="size-3" /> {log.refereePhone}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium border inline-block",
                          log.status === "Subscribed" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          log.status === "First Clean Done" && "bg-green-500/10 text-green-600 border-green-500/20",
                          log.status === "Joined" && "bg-gray-500/10 text-ink-soft border-line",
                        )}
                      >
                        {log.status === "Joined" ? "Signed Up" : log.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-muted">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDate(log.joinedAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
