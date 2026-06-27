import { useState, useEffect } from "react";
import { Radar, Bell, Check, MapPin, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatDate } from "@shared/lib/format";
import { useAlertSettings, useUpdateAlertSettings, useTriggered } from "../api/admin.api";
import type { AlertSettings } from "../types";
import { ApiError } from "@shared/lib/api";

const SAMPLE_SOCIETY = "Green Valley Society";

function renderTemplate(body: string, minutes: number) {
  return body.replace(/\{\{\s*society\s*\}\}/g, SAMPLE_SOCIETY).replace(/\{\{\s*minutes\s*\}\}/g, String(minutes));
}

export function AreaAlerts() {
  const { data: alertSettings } = useAlertSettings();
  const updateSettings = useUpdateAlertSettings();
  const { data: triggered = [] } = useTriggered();
  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (alertSettings) {
      setDraft(alertSettings);
    }
  }, [alertSettings]);

  if (!alertSettings || !draft) return <p className="text-muted">Loading…</p>;

  const save = () => {
    updateSettings.mutate(draft, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Smart Area Alert</h1>
        <p className="mt-1 text-muted">Configure the signature NexClean Nearby notifications.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* settings */}
        <div className="space-y-6">
          <GlassCard className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Radar className="size-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-ink">Area alerts</p>
                  <p className="text-sm text-muted">Configure Smart Area Alert notifications.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                onClick={() => setDraft((d) => (d ? { ...d, enabled: !d.enabled } : null))}
                className={cn(
                  "relative h-7 w-12 shrink-0 overflow-hidden rounded-full border-0 p-0 transition-colors",
                  draft.enabled ? "bg-primary" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
                    draft.enabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>
            <p className={cn("text-sm font-medium", draft.enabled ? "text-emerald-600" : "text-muted")}>
              <span className={cn("inline-block size-2.5 rounded-full mr-2", draft.enabled ? "bg-emerald-500" : "bg-muted")} />
              {draft.enabled ? "Active and monitoring" : "Paused"}
            </p>
          </GlassCard>

          <GlassCard className="space-y-5">
            <p className="font-display text-lg font-semibold text-ink">Trigger rules</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Radius (km)</label>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={draft.radiusKm}
                  onChange={(e) => setDraft((d) => (d ? { ...d, radiusKm: Number(e.target.value) } : null))}
                  className="w-full accent-[var(--color-primary)]"
                />
                <p className="mt-1 text-sm text-muted">
                  Notify customers within <span className="font-medium text-ink">{draft.radiusKm} km</span>
                </p>
              </div>
              <Input
                name="window"
                type="number"
                label="Booking window (minutes)"
                value={draft.windowMinutes}
                onChange={(e) => setDraft((d) => (d ? { ...d, windowMinutes: Number(e.target.value) || 0 } : null))}
              />
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <p className="font-display text-lg font-semibold text-ink">Notification template</p>
            <Input
              name="title"
              label="Title"
              value={draft.title}
              onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : null))}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Body</label>
              <textarea
                rows={3}
                value={draft.body}
                onChange={(e) => setDraft((d) => (d ? { ...d, body: e.target.value } : null))}
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-primary/50"
              />
              <p className="mt-1.5 text-xs text-muted">
                Placeholders: <code className="rounded bg-surface-muted px-1">{"{{society}}"}</code>{" "}
                <code className="rounded bg-surface-muted px-1">{"{{minutes}}"}</code>
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button onClick={save} disabled={updateSettings.isPending} size="sm">
                {updateSettings.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saved ? (
                  <>
                    <Check className="size-4" /> Saved
                  </>
                ) : (
                  "Save settings"
                )}
              </Button>
              {updateSettings.isError && (
                <p className="text-sm text-red-500 mt-2">
                  {updateSettings.error instanceof ApiError && Array.isArray(updateSettings.error.details)
                    ? (updateSettings.error.details as any[]).map((issue: any) => issue.message).join(", ")
                    : updateSettings.error.message || "Failed to save settings"}
                </p>
              )}
            </div>
          </GlassCard>
        </div>

        {/* preview + history */}
        <div className="space-y-6">
          <GlassCard>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Live preview</p>
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{draft.title || "NexClean Nearby"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {renderTemplate(draft.body, draft.windowMinutes)}
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <p className="font-display text-lg font-semibold text-ink">Trigger triggered history</p>
            <div className="mt-4 space-y-3">
              {triggered.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.society}</p>
                    <p className="text-xs text-muted">{t.agentName} · {formatDate(t.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{t.sentCount} sent</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
