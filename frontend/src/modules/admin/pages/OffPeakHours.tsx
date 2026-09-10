import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, Trash2, Save, Loader2, Globe, AlertCircle, Check, Sparkles } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ApiError } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import {
  useOffPeakHours,
  useUpdateOffPeakHours,
  useSuggestOffPeakHours,
  type OffPeakWindowInput,
} from "../api/admin.api";
import type { WeekdayIndex, OffPeakSuggestion } from "../types";

const WEEKDAYS: { index: WeekdayIndex; label: string; short: string }[] = [
  { index: 0, label: "Sunday", short: "Sun" },
  { index: 1, label: "Monday", short: "Mon" },
  { index: 2, label: "Tuesday", short: "Tue" },
  { index: 3, label: "Wednesday", short: "Wed" },
  { index: 4, label: "Thursday", short: "Thu" },
  { index: 5, label: "Friday", short: "Fri" },
  { index: 6, label: "Saturday", short: "Sat" },
];

/** Zones NexClean plausibly operates in. Free text is still allowed via the input. */
const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string): number | null {
  const m = HHMM.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Draft row — kept as raw strings so a half-typed "0" isn't rejected mid-keystroke. */
type DraftWindow = { key: string; day: WeekdayIndex; start: string; end: string; label: string };

let rowCounter = 0;
const nextKey = () => `w${++rowCounter}`;

/**
 * Mirrors the server's rules (offPeakHours.service#normalizeWindows) so an admin
 * sees the problem next to the row that causes it, rather than as one API error
 * after saving. The server stays authoritative — this only shortens the loop.
 */
function validateDraft(rows: DraftWindow[]): Map<string, string> {
  const errors = new Map<string, string>();
  const parsed = rows.map((r) => ({ ...r, startMin: toMinutes(r.start), endMin: toMinutes(r.end) }));

  for (const row of parsed) {
    if (row.startMin === null) {
      errors.set(row.key, "Start must be a 24-hour time like 08:00");
    } else if (row.endMin === null) {
      errors.set(row.key, "End must be a 24-hour time like 12:00");
    } else if (row.endMin <= row.startMin) {
      errors.set(row.key, "End must be after start");
    }
  }

  // Overlap check, per day, only across rows that parsed cleanly.
  const byDay = new Map<number, typeof parsed>();
  for (const row of parsed) {
    if (errors.has(row.key) || row.startMin === null || row.endMin === null) continue;
    byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
  }
  for (const [, dayRows] of byDay) {
    const sorted = [...dayRows].sort((a, b) => a.startMin! - b.startMin!);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMin! < sorted[i - 1].endMin!) {
        errors.set(sorted[i].key, "Overlaps another window on this day");
      }
    }
  }
  return errors;
}

/** The eight bookable slots, in order, for the demand grid's columns. */
const GRID_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

/**
 * Proposes windows from booking history, showing the numbers behind the
 * proposal. Loading it into the editor leaves it unsaved — pricing should never
 * change without an admin looking at it first.
 */
function SuggestionPanel({
  suggestion,
  error,
  pending,
  onRun,
  onUse,
  onDismiss,
}: {
  suggestion: OffPeakSuggestion | null;
  error: string;
  pending: boolean;
  onRun: () => void;
  onUse: (s: OffPeakSuggestion) => void;
  onDismiss: () => void;
}) {
  // Tint each cell by how busy it is relative to the busiest slot that week, so
  // the shape of demand is readable at a glance rather than by reading numbers.
  const busiest = suggestion ? Math.max(1, ...suggestion.grid.map((c) => c.count)) : 1;

  return (
    <GlassCard className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Sparkles className="size-5 text-primary" /> Suggest from history
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Reads completed bookings and proposes the quiet windows. Bookings won by an off-peak
            coupon are left out, so this measures demand at full price rather than the discount's own
            effect.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRun} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Reading…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Suggest
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-300/50 bg-red-50/70 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {suggestion && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            {suggestion.totalBookings} booking{suggestion.totalBookings === 1 ? "" : "s"} over the last{" "}
            {suggestion.lookbackWeeks} weeks
            {suggestion.excludedDiscounted > 0 &&
              ` · ${suggestion.excludedDiscounted} discounted booking${
                suggestion.excludedDiscounted === 1 ? "" : "s"
              } excluded`}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-1.5 text-left font-medium text-muted">&nbsp;</th>
                  {GRID_SLOTS.map((slot) => (
                    <th key={slot} className="p-1.5 font-medium text-muted">
                      {slot.replace(" ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day) => {
                  const summary = suggestion.days.find((d) => d.day === day.index);
                  return (
                    <tr key={day.index}>
                      <td className="p-1.5 text-left text-muted">{day.short}</td>
                      {GRID_SLOTS.map((slot) => {
                        const cell = suggestion.grid.find((c) => c.day === day.index && c.slot === slot);
                        const count = cell?.count ?? 0;
                        return (
                          <td key={slot} className="p-0.5">
                            <span
                              className={cn(
                                "block rounded-md py-1 tabular-nums",
                                !summary?.enoughData
                                  ? "bg-surface-muted/50 text-muted"
                                  : cell?.offPeak
                                    ? "bg-emerald-500/15 font-medium text-emerald-700"
                                    : "text-ink-soft",
                              )}
                              style={
                                summary?.enoughData && !cell?.offPeak
                                  ? { background: `rgba(178, 106, 18, ${(count / busiest) * 0.22})` }
                                  : undefined
                              }
                              title={`${day.label} ${slot}: ${count} booking${count === 1 ? "" : "s"}`}
                            >
                              {count}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-emerald-500/25" /> proposed off-peak
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded" style={{ background: "rgba(178, 106, 18, 0.22)" }} /> busier
            </span>
            {suggestion.days.some((d) => !d.enoughData) && (
              <span>
                Greyed days have too little history to judge —{" "}
                {suggestion.days
                  .filter((d) => !d.enoughData)
                  .map((d) => d.label)
                  .join(", ")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => onUse(suggestion)}
              disabled={suggestion.windows.length === 0}
            >
              Load {suggestion.windows.length} window{suggestion.windows.length === 1 ? "" : "s"} into the editor
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
            <span className="text-xs text-muted">Nothing is saved until you press Save changes.</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export function OffPeakHours() {
  const { data: config, isLoading } = useOffPeakHours();
  const update = useUpdateOffPeakHours();

  const [rows, setRows] = useState<DraftWindow[]>([]);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [active, setActive] = useState(true);
  const [fee, setFee] = useState("100");
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const suggestMutation = useSuggestOffPeakHours();
  const [suggestion, setSuggestion] = useState<OffPeakSuggestion | null>(null);
  const [suggestError, setSuggestError] = useState("");

  // Seed the draft from the server exactly once. Re-seeding on every `config`
  // change would wipe unsaved edits the moment the query refetched in the
  // background, which is the classic way an admin loses a screen full of work.
  useEffect(() => {
    if (!config || hydrated) return;
    setRows(
      config.windows.map((w) => ({
        key: nextKey(),
        day: w.day,
        start: w.start,
        end: w.end,
        label: w.label ?? "",
      })),
    );
    setTimezone(config.timezone);
    setActive(config.active);
    setFee(String(config.peakUpgradeFee ?? 0));
    setHydrated(true);
  }, [config, hydrated]);

  const errors = useMemo(() => validateDraft(rows), [rows]);
  const hasErrors = errors.size > 0;

  const feeValue = Number(fee);
  const feeInvalid = fee.trim() === "" || !Number.isFinite(feeValue) || feeValue < 0;

  const dirty = useMemo(() => {
    if (!config) return false;
    if (config.timezone !== timezone || config.active !== active) return true;
    if (!feeInvalid && Math.round(feeValue) !== (config.peakUpgradeFee ?? 0)) return true;
    if (config.windows.length !== rows.length) return true;
    return config.windows.some((w, i) => {
      const r = rows[i];
      return !r || r.day !== w.day || r.start !== w.start || r.end !== w.end || (r.label ?? "") !== (w.label ?? "");
    });
  }, [config, rows, timezone, active, feeValue, feeInvalid]);

  const addRow = (day: WeekdayIndex) =>
    setRows((prev) => [...prev, { key: nextKey(), day, start: "08:00", end: "12:00", label: "" }]);

  const patchRow = (key: string, patch: Partial<DraftWindow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  /**
   * Load a proposal into the editor as an unsaved draft. Nothing reaches the
   * server until the admin presses Save — a suggestion is a starting point, not
   * a price change.
   */
  const applySuggestion = (proposed: OffPeakSuggestion) => {
    setRows(
      proposed.windows.map((w) => ({
        key: nextKey(),
        day: w.day,
        start: w.start,
        end: w.end,
        label: w.label ?? "",
      })),
    );
  };

  const runSuggest = () => {
    setSuggestError("");
    suggestMutation.mutate(
      {},
      {
        onSuccess: (result) => setSuggestion(result),
        onError: (e) =>
          setSuggestError(
            e instanceof ApiError ? e.message : "Couldn't read booking history. Please try again.",
          ),
      },
    );
  };

  const save = () => {
    if (hasErrors || feeInvalid) return;
    setSaveError("");
    const windows: OffPeakWindowInput[] = rows.map((r) => ({
      day: r.day,
      start: r.start.trim(),
      end: r.end.trim(),
      label: r.label.trim() || undefined,
    }));
    update.mutate(
      { timezone: timezone.trim(), active, peakUpgradeFee: Math.round(feeValue), windows },
      {
        onSuccess: () => {
          setSavedAt(Date.now());
          // Accept the server's canonicalised form as the new baseline so the
          // dirty check compares like with like ("8:00" comes back "08:00").
          setHydrated(false);
        },
        onError: (e) =>
          setSaveError(e instanceof ApiError ? e.message : "Couldn't save off-peak hours. Please try again."),
      },
    );
  };

  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const totalWeeklyHours = useMemo(() => {
    let minutes = 0;
    for (const r of rows) {
      const s = toMinutes(r.start);
      const e = toMinutes(r.end);
      if (s !== null && e !== null && e > s) minutes += e - s;
    }
    return minutes / 60;
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Off-Peak Hours</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Mark the quiet windows on each weekday — the hours you want to fill. Coupons marked{" "}
            <span className="font-medium text-ink">off-peak hours only</span> apply just to bookings
            whose time slot falls inside one of these windows. Everything else is a peak slot, sold at
            full price.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt !== null && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="size-4" /> Saved
            </span>
          )}
          <Button onClick={save} disabled={update.isPending || hasErrors || feeInvalid || !dirty}>
            {update.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="size-4" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-300/50 bg-red-50/70 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Master switch + timezone */}
      <GlassCard className="space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">Configuration</p>
        </div>

        <button
          type="button"
          onClick={() => setActive((a) => !a)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
            active ? "border-primary/50 bg-primary/5" : "border-line bg-surface hover:border-primary/40",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {active ? "Off-peak discounts are live" : "Off-peak discounts are paused"}
            </p>
            <p className="text-xs text-muted">
              {active
                ? "Off-peak coupons apply on the windows below."
                : "Every off-peak coupon is inactive while this is off — the windows below are kept."}
            </p>
          </div>
          <span
            className={cn(
              "flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
              active ? "justify-end bg-primary" : "justify-start bg-line",
            )}
          >
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
        </button>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Input
              name="timezone"
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              hint="All window times are interpreted in this IANA zone, whatever the server runs in."
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {COMMON_TIMEZONES.map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => setTimezone(tz)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  timezone === tz
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-line text-muted hover:border-primary/40 hover:text-ink",
                )}
              >
                {tz}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-xs">
          <Input
            name="peakUpgradeFee"
            label="Peak upgrade fee (₹)"
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            error={feeInvalid ? "Enter a fee of ₹0 or more" : undefined}
            hint="Charged when a customer moves a discounted booking into a peak slot, on top of paying the discount back."
          />
        </div>

        <p className="text-xs text-muted">
          {rows.length} window{rows.length === 1 ? "" : "s"} · {totalWeeklyHours.toFixed(1)} discounted hours per week
        </p>
      </GlassCard>

      <SuggestionPanel
        suggestion={suggestion}
        error={suggestError}
        pending={suggestMutation.isPending}
        onRun={runSuggest}
        onUse={applySuggestion}
        onDismiss={() => setSuggestion(null)}
      />

      {/* Per-weekday windows */}
      <div className="space-y-4">
        {WEEKDAYS.map((day) => {
          const dayRows = rows.filter((r) => r.day === day.index);
          return (
            <GlassCard key={day.index} className="space-y-4" data-testid={`off-peak-day-${day.index}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  <p className="font-display text-lg font-semibold text-ink">{day.label}</p>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
                    {dayRows.length === 0
                      ? "No discounted hours"
                      : `${dayRows.length} window${dayRows.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => addRow(day.index)}>
                  <Plus className="size-4" /> Add window
                </Button>
              </div>

              {dayRows.length === 0 ? (
                <p className="text-sm text-muted">
                  Full price all day — off-peak coupons never apply on a {day.label}.
                </p>
              ) : (
                <div className="space-y-2">
                  {dayRows.map((row) => {
                    const error = errors.get(row.key);
                    return (
                      <div
                        key={row.key}
                        className={cn(
                          "rounded-2xl border p-3",
                          error ? "border-red-300/60 bg-red-50/40" : "border-line bg-surface/60",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={row.start}
                              onChange={(e) => patchRow(row.key, { start: e.target.value })}
                              aria-label={`${day.label} window start`}
                              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                            />
                            <span className="text-muted">→</span>
                            <input
                              type="time"
                              value={row.end}
                              onChange={(e) => patchRow(row.key, { end: e.target.value })}
                              aria-label={`${day.label} window end`}
                              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                            />
                          </div>
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => patchRow(row.key, { label: e.target.value })}
                            placeholder="Label (optional) — e.g. Sunday morning rush"
                            maxLength={60}
                            aria-label={`${day.label} window label`}
                            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(row.key)}
                            aria-label="Remove window"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted">
        A window covers its start time up to — but not including — its end time, so 08:00→12:00 and
        12:00→14:00 sit back to back without overlapping. To span midnight, add one window ending at
        23:59 and another starting at 00:00 on the following day.
      </p>
    </div>
  );
}
