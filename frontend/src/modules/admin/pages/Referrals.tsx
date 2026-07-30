import { useState, useEffect } from "react";
import {
  Gift, Users, Search, Calendar, Phone, ArrowRight,
  CheckCircle2, Award, Loader2, Sparkles, Coins, Save, Pencil,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { Pagination } from "@shared/ui/Pagination";
import { formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { useReferralLogs, useReferralConfig, useUpdateReferralConfig } from "../api/admin.api";
import { cn } from "@shared/lib/utils";

function ReferralSettingsSection() {
  const { data: config } = useReferralConfig();
  const update = useUpdateReferralConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [referrerReward, setReferrerReward] = useState("");
  const [refereeReward, setRefereeReward] = useState("");
  const [coinsPerRupee, setCoinsPerRupee] = useState("");
  const [maxRedeemPercent, setMaxRedeemPercent] = useState("");
  const [active, setActive] = useState(true);

  // Sync local form state once the config loads.
  useEffect(() => {
    if (!config) return;
    setReferrerReward(String(config.referrerReward));
    setRefereeReward(String(config.refereeReward));
    setCoinsPerRupee(String(config.coinsPerRupee));
    setMaxRedeemPercent(String(config.maxRedeemPercent));
    setActive(config.active);
  }, [config]);

  const save = () => {
    update.mutate(
      {
        referrerReward: Number(referrerReward),
        refereeReward: Number(refereeReward),
        coinsPerRupee: Number(coinsPerRupee),
        maxRedeemPercent: Number(maxRedeemPercent),
        active,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const cancelEdit = () => {
    if (config) {
      setReferrerReward(String(config.referrerReward));
      setRefereeReward(String(config.refereeReward));
      setCoinsPerRupee(String(config.coinsPerRupee));
      setMaxRedeemPercent(String(config.maxRedeemPercent));
      setActive(config.active);
    }
    setIsEditing(false);
  };

  const rate = Number(coinsPerRupee) || 1;

  return (
    <GlassCard className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">Referral Program Settings</p>
        </div>
        <button
          type="button"
          disabled={!isEditing}
          onClick={() => isEditing && setActive((a) => !a)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
            active
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : "bg-gray-500/10 text-muted border-line",
            !isEditing && "cursor-default opacity-80"
          )}
        >
          {active ? "Program Active" : "Program Paused"}
        </button>
      </div>
      <p className="text-sm text-muted">
        A single program for the whole app. Rewards are paid in coins; the conversion rate sets what a coin is
        worth when customers redeem them at checkout.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted">Referrer reward (coins)</span>
          <Input
            name="referrerReward"
            type="number"
            min="0"
            disabled={!isEditing}
            value={referrerReward}
            onChange={(e) => setReferrerReward(e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted">New user reward (coins)</span>
          <Input
            name="refereeReward"
            type="number"
            min="0"
            disabled={!isEditing}
            value={refereeReward}
            onChange={(e) => setRefereeReward(e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted">Conversion rate (coins per ₹1)</span>
          <Input
            name="coinsPerRupee"
            type="number"
            min="1"
            disabled={!isEditing}
            value={coinsPerRupee}
            onChange={(e) => setCoinsPerRupee(e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted">Max order covered by coins (%)</span>
          <Input
            name="maxRedeemPercent"
            type="number"
            min="0"
            max="100"
            disabled={!isEditing}
            value={maxRedeemPercent}
            onChange={(e) => setMaxRedeemPercent(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          e.g. ₹1 = {rate} coin{rate === 1 ? "" : "s"} · {Number(referrerReward) || 0} coins ≈ ₹
          {Math.floor((Number(referrerReward) || 0) / rate)} for the referrer.
        </p>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={update.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={update.isPending}>
                <Save className="size-4" /> {update.isPending ? "Saving…" : "Save settings"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="size-4" /> Edit settings
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function Referrals() {
  const { data: logs = [], isLoading } = useReferralLogs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const cleansDoneCount = logs.filter(
    (l) => l.status === "First Clean Done" || l.status === "Subscribed",
  ).length;
  const subscribedCount = logs.filter((l) => l.status === "Subscribed").length;

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      l.referrerName.toLowerCase().includes(q) ||
      l.referrerPhone.includes(q) ||
      l.referrerCode.toLowerCase().includes(q) ||
      l.refereeName.toLowerCase().includes(q) ||
      l.refereePhone.includes(q);

    const matchesStatus =
      statusFilter === "all" || l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const paginated = usePagination(filtered, 10);

  return (
    <div className="space-y-6">
      {/* Top title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Referrals</h1>
          <p className="mt-1 text-sm text-muted">
            Configure the referral program and track invitation logs & conversion milestones.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {logs.length} Total Logs
          </span>
        </div>
      </div>

      <ReferralSettingsSection />

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
                {paginated.pageItems.map((log) => (
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
          <div className="p-4">
            <Pagination
              page={paginated.page}
              totalPages={paginated.totalPages}
              onPageChange={paginated.setPage}
            />
          </div>
        </GlassCard>
      )}
    </div>
  );
}
