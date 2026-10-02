import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, BellRing, Check, Loader2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ApiError } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { useReferralSummary } from "../api/queries";
import { useRemindReferredUser } from "../api/mutations";
import type { ReferredUser, ReferralStage } from "../types";

const STAGE_ORDER: ReferralStage[] = ["joined", "booked", "completed", "rewarded"];

const BADGE: Record<ReferralStage, { label: string; className: string }> = {
  joined: { label: "Yet to book", className: "bg-blue-500/10 text-blue-700" },
  booked: { label: "Booked", className: "bg-violet-500/10 text-violet-700" },
  completed: { label: "Wash done", className: "bg-amber-500/10 text-amber-700" },
  rewarded: { label: "Rewarded", className: "bg-emerald-500/10 text-emerald-700" },
};

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Profile → Refer & Earn → Referred users: every friend who joined with your code, and how far they've got. */
export function ReferredUsers() {
  const navigate = useNavigate();
  const { data: referrals, isLoading } = useReferralSummary();
  const [query, setQuery] = useState("");

  const friends = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = referrals?.referredUsers ?? [];
    return q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all;
  }, [referrals, query]);

  const total = referrals?.referredUsers.length ?? 0;
  const reward = referrals?.rewardAmount ?? 100;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Referred users</h1>
          <p className="text-sm text-muted">
            You earn {reward} coins when a friend completes their first service.
          </p>
        </div>
      </div>

      {total > 0 && (
        <Input
          name="search"
          placeholder="Search your referred friends"
          leading={<Search className="size-4" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted">Loading your referrals…</p>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <Users className="mx-auto mb-2 size-8 text-muted" />
          <p className="text-sm font-semibold text-ink-soft">No referrals yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
            When friends sign up using your referral code, they&apos;ll appear here with their progress.
          </p>
        </div>
      ) : friends.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No referred friend matches “{query}”.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {friends.map((f) => (
            <FriendCard key={f.id} friend={f} reward={reward} />
          ))}
        </div>
      )}
    </div>
  );
}

function FriendCard({ friend, reward }: { friend: ReferredUser; reward: number }) {
  const remind = useRemindReferredUser();
  const [sent, setSent] = useState(false);
  const reached = STAGE_ORDER.indexOf(friend.stage);
  const coolingDown = !!friend.remindAgainAt && new Date(friend.remindAgainAt).getTime() > Date.now();
  const badge = BADGE[friend.stage];

  const steps = [
    { label: "Signed up", detail: formatDay(friend.joinedAt) },
    { label: "Booked", detail: reached >= 1 ? "Done" : "Not yet" },
    { label: "First wash", detail: reached >= 2 ? "Completed" : "Pending" },
    {
      label: "Your reward",
      detail:
        friend.rewardStatus === "credited"
          ? `+${reward} coins`
          : friend.rewardStatus === "withheld"
            ? "Not eligible"
            : "Pending",
    },
  ];

  return (
    <GlassCard className="flex flex-col gap-5 border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-snug text-ink wrap-anywhere">{friend.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">Joined {formatDay(friend.joinedAt)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", badge.className)}>
          {badge.label}
        </span>
      </div>

      {/* Journey */}
      <ol className="grid grid-cols-4 gap-1.5">
        {steps.map((step, i) => {
          const done = i === 3 ? friend.rewardStatus === "credited" : i <= reached;
          return (
            <li key={step.label} className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-xs font-bold",
                  done ? (i === 3 ? "bg-emerald-500 text-white" : "bg-primary text-white") : "border border-line text-muted",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="mt-1.5 text-[11px] font-semibold leading-tight text-ink">{step.label}</span>
              <span className={cn("text-[10px] leading-tight", i === 3 && done ? "text-amber-600" : "text-muted")}>
                {step.detail}
              </span>
            </li>
          );
        })}
      </ol>

      {friend.canRemind && (
        <div className="border-t border-line pt-4">
          {sent || coolingDown ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Check className="size-3.5 text-emerald-600" />
              {sent ? "Reminder sent." : "Reminded today."} You can remind {friend.name.split(" ")[0]} again tomorrow.
            </p>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={remind.isPending}
                onClick={() => remind.mutate(friend.id, { onSuccess: () => setSent(true) })}
              >
                {remind.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
                Remind to book first service
              </Button>
              {remind.isError && (
                <p className="mt-2 text-xs text-red-600">
                  {remind.error instanceof ApiError ? remind.error.message : "Couldn't send the reminder."}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
