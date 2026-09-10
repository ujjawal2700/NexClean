import { useState } from "react";
import { Megaphone, Send, Check, Users, Bell, Smartphone } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { formatDate } from "@shared/lib/format";
import { usePagination } from "@shared/lib/usePagination";
import { useCampaigns, useSendCampaign, useAudienceSizes, useAudienceGroups } from "../api/admin.api";

/** Fallback ordering used only until the server's audience list arrives. */
const DEFAULT_AUDIENCE = "All customers";

export function Notifications() {
  const { data: campaigns = [] } = useCampaigns();
  const { data: audienceSizes } = useAudienceSizes();
  const { data: audienceGroups = [] } = useAudienceGroups();
  const sendCampaign = useSendCampaign();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(DEFAULT_AUDIENCE);
  const [sent, setSent] = useState<number | null>(null);

  const paginatedCampaigns = usePagination(campaigns, 5);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    const campaign = await sendCampaign.mutateAsync({ title: title.trim(), body: body.trim(), audience });
    setSent(campaign.sentCount);
    setTitle("");
    setBody("");
    setTimeout(() => setSent(null), 2500);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Push Notifications</h1>
        <p className="mt-1 text-muted">Send manual campaigns to customers or agents via Firebase Cloud Messaging (FCM).</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* composer */}
        <GlassCard className="space-y-4">
          <p className="font-display text-lg font-semibold text-ink">New campaign</p>

          <Input name="title" label="Title" placeholder="e.g. Weekend Sparkle Offer" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Message</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What do you want to tell them?"
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
            />
          </div>

          {/* Grouped by app rather than one flat row: "All agents" and "All
              customers" sitting side by side is exactly the pair you don't want
              to mix up when the message is about to go out. */}
          <div className="space-y-3" role="group" aria-label="Audience">
            <label className="block text-sm font-medium text-ink">Audience</label>
            {audienceGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.audiences.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      aria-pressed={audience === a}
                      className={cn(
                        "rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        audience === a
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-line bg-surface text-muted hover:text-ink",
                      )}
                    >
                      {a}
                      {audienceSizes && (
                        <span className="ml-1 text-xs opacity-70">
                          ({(audienceSizes[a] ?? 0).toLocaleString("en-IN")})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={send} disabled={!title.trim() || !body.trim() || sendCampaign.isPending}>
              {sent !== null ? (
                <>
                  <Check className="size-4" /> Sent to {sent.toLocaleString("en-IN")}
                </>
              ) : (
                <>
                  <Send className="size-4" /> Send campaign
                </>
              )}
            </Button>
          </div>
        </GlassCard>

        {/* preview */}
        <GlassCard>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                <Megaphone className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{title || "Your campaign title"}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {body || "Your message preview appears here."}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted">
                  <Users className="size-3" /> {audience}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* history */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Campaign history</p>
          <span className="text-xs text-muted">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {paginatedCampaigns.pageItems.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{c.title}</p>
                <p className="truncate text-sm text-muted">{c.body}</p>
                <p className="mt-1 text-xs text-muted">{c.audience} · {formatDate(c.createdAt)}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Bell className="size-3" /> {c.pushDelivered.toLocaleString("en-IN")} push
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Smartphone className="size-3" /> {c.inAppOnly.toLocaleString("en-IN")} in-app only
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-primary">
                {c.sentCount.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          {campaigns.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">No campaigns sent yet.</p>
          )}
        </div>

        <Pagination
          page={paginatedCampaigns.page}
          totalPages={paginatedCampaigns.totalPages}
          onPageChange={paginatedCampaigns.setPage}
        />
      </GlassCard>
    </div>
  );
}
