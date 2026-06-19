import { useState } from "react";
import { Megaphone, Send, Check, Users } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatDate } from "@shared/lib/format";
import { useCampaigns, useSendCampaign } from "../api/admin.api";

const AUDIENCES = ["All customers", "Active customers", "Lapsed customers", "Subscribers"];

export function Notifications() {
  const { data: campaigns = [] } = useCampaigns();
  const sendCampaign = useSendCampaign();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [sent, setSent] = useState<number | null>(null);

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
        <p className="mt-1 text-muted">Send manual campaigns to your customers (via FCM, later).</p>
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
              placeholder="What do you want to tell your customers?"
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Audience</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={cn(
                    "rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    audience === a
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
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
        <p className="font-display text-lg font-semibold text-ink">Campaign history</p>
        <div className="mt-4 space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{c.title}</p>
                <p className="truncate text-sm text-muted">{c.body}</p>
                <p className="mt-1 text-xs text-muted">{c.audience} · {formatDate(c.createdAt)}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-primary">
                {c.sentCount.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
