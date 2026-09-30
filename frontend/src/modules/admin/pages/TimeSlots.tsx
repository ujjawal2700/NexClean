import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  AlertCircle,
  Save,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Info,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useTimeSlots, useUpdateTimeSlots } from "../api/admin.api";

const DEFAULT_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

const EXTENDED_PRESET = [
  "06:00 AM",
  "07:30 AM",
  "09:00 AM",
  "10:30 AM",
  "12:00 PM",
  "01:30 PM",
  "03:00 PM",
  "04:30 PM",
  "06:00 PM",
  "07:30 PM",
  "09:00 PM",
];

const EARLY_AND_LATE_PRESET = [
  "05:00 AM",
  "06:30 AM",
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
  "08:00 PM",
  "09:30 PM",
];

function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function to24h(slot: string): string {
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "08:00";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${h.toString().padStart(2, "0")}:${m}`;
}

function slotMinutes(slot: string): number {
  const match = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return h * 60 + m;
}

export function TimeSlots() {
  const { data: serverConfig, isLoading } = useTimeSlots();
  const updateMutation = useUpdateTimeSlots();

  const [draftSlots, setDraftSlots] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("07:00");
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync draft whenever server config loads or changes
  useEffect(() => {
    if (serverConfig?.slots) {
      setDraftSlots(serverConfig.slots);
    } else if (!isLoading) {
      setDraftSlots(DEFAULT_SLOTS);
    }
  }, [serverConfig, isLoading]);

  const serverSlots = useMemo(() => serverConfig?.slots ?? DEFAULT_SLOTS, [serverConfig]);

  const isDirty = useMemo(() => {
    if (draftSlots.length !== serverSlots.length) return true;
    return draftSlots.some((s, i) => s !== serverSlots[i]);
  }, [draftSlots, serverSlots]);

  const handleAddSlot = () => {
    setError("");
    const formatted = to12h(newTime);
    if (draftSlots.includes(formatted)) {
      setError(`Slot "${formatted}" already exists.`);
      return;
    }
    const next = [...draftSlots, formatted].sort((a, b) => slotMinutes(a) - slotMinutes(b));
    setDraftSlots(next);
  };

  const handleRemoveSlot = (index: number) => {
    setError("");
    if (draftSlots.length <= 1) {
      setError("At least one booking time slot must remain available.");
      return;
    }
    setDraftSlots(draftSlots.filter((_, i) => i !== index));
  };

  const handleTimeChange = (index: number, newTime24: string) => {
    setError("");
    const formatted = to12h(newTime24);
    if (draftSlots.some((s, i) => i !== index && s === formatted)) {
      setError(`Slot "${formatted}" is already in the list.`);
      return;
    }
    const updated = [...draftSlots];
    updated[index] = formatted;
    setDraftSlots(updated.sort((a, b) => slotMinutes(a) - slotMinutes(b)));
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftSlots.length) return;
    const next = [...draftSlots];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setDraftSlots(next);
  };

  const handleSortChronologically = () => {
    const next = [...draftSlots].sort((a, b) => slotMinutes(a) - slotMinutes(b));
    setDraftSlots(next);
  };

  const handleApplyPreset = (preset: string[]) => {
    setError("");
    setDraftSlots([...preset]);
  };

  const handleSave = async () => {
    setError("");
    if (draftSlots.length === 0) {
      setError("Please configure at least one time slot.");
      return;
    }
    try {
      await updateMutation.mutateAsync({ slots: draftSlots });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to save time slots.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Time Slot Management</h1>
          <p className="mt-1 text-muted">
            Configure bookable service slots for the customer app. Changes apply immediately across all days.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3.5 py-1.5 text-xs font-semibold text-green-600 animate-in fade-in duration-200">
              <Check className="size-4" /> Changes saved live!
            </span>
          )}

          <Button
            onClick={handleSave}
            disabled={!isDirty || updateMutation.isPending}
            className="shadow-sm"
          >
            <Save className="size-4" />
            {updateMutation.isPending ? "Saving…" : isDirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info notice */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-ink-soft space-y-1">
          <p className="font-semibold text-ink">How booking time slots work</p>
          <p>
            When you add early morning (e.g. 05:00 AM) or late evening (e.g. 09:00 PM) time slots here, they will
            instantly appear in the customer app's service booking date & time picker, reschedule modal, and off-peak hour demand analytics.
          </p>
          <p className="text-muted">
            Existing past or upcoming bookings made with previously selected slots remain completely unaffected and valid.
          </p>
        </div>
      </div>

      {/* Main configuration grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Current configured slots */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                <h3 className="font-display text-lg font-semibold text-ink">Active Time Slots</h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {draftSlots.length} slots
                </span>
              </div>

              <button
                type="button"
                onClick={handleSortChronologically}
                className="text-xs font-medium text-muted hover:text-primary transition-colors text-left"
              >
                Sort chronologically
              </button>
            </div>

            {/* List of slots */}
            <div className="space-y-2.5">
              {draftSlots.map((slot, index) => {
                const time24 = to24h(slot);
                const isFirst = index === 0;
                const isLast = index === draftSlots.length - 1;

                return (
                  <div
                    key={`${slot}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/80 p-3 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 place-items-center rounded-xl bg-surface-muted text-xs font-mono font-medium text-muted">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-display font-bold text-base text-ink tracking-tight">{slot}</p>
                        <p className="text-[11px] text-muted font-mono">24h format: {time24}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Direct Time Editor */}
                      <input
                        type="time"
                        value={time24}
                        onChange={(e) => e.target.value && handleTimeChange(index, e.target.value)}
                        className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-mono text-ink outline-none focus:border-primary/50"
                        title="Edit slot time"
                      />

                      {/* Move controls */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={isFirst}
                          className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
                          title="Move up"
                        >
                          <ArrowUp className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={isLast}
                          className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
                          title="Move down"
                        >
                          <ArrowDown className="size-4" />
                        </button>
                      </div>

                      {/* Remove */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSlot(index)}
                        disabled={draftSlots.length <= 1}
                        className="text-red-600 hover:bg-red-500/10 px-2"
                        title="Remove slot"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add slot row */}
            <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Add a new time slot</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-mono text-ink outline-none focus:border-primary/50"
                />
                <Button type="button" onClick={handleAddSlot}>
                  <Plus className="size-4" /> Add "{to12h(newTime)}"
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right: Presets & Quick Actions */}
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-display text-base font-semibold text-ink">Slot Presets</h3>
            </div>

            <p className="text-xs text-muted">
              Choose one of the curated standard schedules or reset back to default at any time.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleApplyPreset(DEFAULT_SLOTS)}
                className="w-full text-left rounded-2xl border border-line bg-surface/60 p-3.5 hover:border-primary/40 hover:bg-surface transition-all group"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-ink group-hover:text-primary transition-colors">
                    Standard Working Hours
                  </h4>
                  <span className="text-[10px] text-muted font-mono font-medium">8 slots</span>
                </div>
                <p className="text-xs text-muted mt-1">08:00 AM to 06:30 PM (every 90 mins)</p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(EXTENDED_PRESET)}
                className="w-full text-left rounded-2xl border border-line bg-surface/60 p-3.5 hover:border-primary/40 hover:bg-surface transition-all group"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-ink group-hover:text-primary transition-colors">
                    Extended Hours
                  </h4>
                  <span className="text-[10px] text-muted font-mono font-medium">11 slots</span>
                </div>
                <p className="text-xs text-muted mt-1">06:00 AM to 09:00 PM (early to late)</p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(EARLY_AND_LATE_PRESET)}
                className="w-full text-left rounded-2xl border border-line bg-surface/60 p-3.5 hover:border-primary/40 hover:bg-surface transition-all group"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-ink group-hover:text-primary transition-colors">
                    Full Day (05:00 AM – 09:30 PM)
                  </h4>
                  <span className="text-[10px] text-muted font-mono font-medium">12 slots</span>
                </div>
                <p className="text-xs text-muted mt-1">Includes early dawn and late night slots</p>
              </button>
            </div>

            <div className="pt-2 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPreset(DEFAULT_SLOTS)}
                className="w-full text-muted hover:text-ink"
              >
                <RotateCcw className="size-3.5" /> Reset to Original Defaults
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
