import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Loader2, Plus, Save, Trash2, Info } from "lucide-react";
import { ApiError } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useTimeSlots, useUpdateTimeSlots } from "../api/admin.api";

/** Ready-made schedules. "Standard" is the server's own default list. */
const PRESETS: { label: string; hint: string; slots: string[] }[] = [
  {
    label: "Extended hours",
    hint: "06:00 AM – 09:00 PM, every 90 min",
    slots: [
      "06:00 AM", "07:30 AM", "09:00 AM", "10:30 AM", "12:00 PM", "01:30 PM",
      "03:00 PM", "04:30 PM", "06:00 PM", "07:30 PM", "09:00 PM",
    ],
  },
  {
    label: "Full day",
    hint: "05:00 AM – 09:30 PM, every 90 min",
    slots: [
      "05:00 AM", "06:30 AM", "08:00 AM", "09:30 AM", "11:00 AM", "12:30 PM",
      "02:00 PM", "03:30 PM", "05:00 PM", "06:30 PM", "08:00 PM", "09:30 PM",
    ],
  },
];

/** "14:30" (time input) → "02:30 PM" (the slot shape bookings store). */
function to12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** "02:30 PM" → minutes from midnight, for sorting. */
function slotMinutes(slot: string): number {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  const h = Number(match[1]) % 12;
  return (match[3].toUpperCase() === "PM" ? h + 12 : h) * 60 + Number(match[2]);
}

function to24h(slot: string): string {
  const mins = slotMinutes(slot);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

const sortSlots = (slots: string[]) => [...slots].sort((a, b) => slotMinutes(a) - slotMinutes(b));

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/**
 * Admin control for the bookable time slots customers pick from when booking,
 * rescheduling or setting a subscription schedule.
 */
export function TimeSlots() {
  const { data: config, isLoading } = useTimeSlots();
  const update = useUpdateTimeSlots();
  const [draft, setDraft] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("07:00");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setDraft(config.slots);
  }, [config]);

  const maxSlots = config?.maxSlots ?? 48;
  const defaults = config?.defaults ?? [];
  const dirty = config ? !sameList(draft, config.slots) : false;
  const presets = useMemo(
    () => [{ label: "Standard", hint: "08:00 AM – 06:30 PM, every 90 min", slots: defaults }, ...PRESETS],
    [defaults],
  );

  const change = (next: string[]) => {
    setError("");
    setSaved(false);
    setDraft(sortSlots(next));
  };

  const addSlot = () => {
    const slot = to12h(newTime);
    if (draft.includes(slot)) return setError(`${slot} is already a slot.`);
    if (draft.length >= maxSlots) return setError(`You can have at most ${maxSlots} slots.`);
    change([...draft, slot]);
  };

  const editSlot = (index: number, time24: string) => {
    const slot = to12h(time24);
    if (draft.some((s, i) => i !== index && s === slot)) return setError(`${slot} is already a slot.`);
    change(draft.map((s, i) => (i === index ? slot : s)));
  };

  const removeSlot = (index: number) => {
    if (draft.length <= 1) return setError("Keep at least one slot, or customers can't book at all.");
    change(draft.filter((_, i) => i !== index));
  };

  const save = () => {
    setError("");
    update.mutate({ slots: draft }, { onSuccess: () => setSaved(true) });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Time Slots</h1>
          <p className="mt-1 max-w-2xl text-muted">
            The service start times customers can pick when they book, reschedule or set up a subscription.
            Each slot is a 90-minute window.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="size-4" /> Saved
            </span>
          )}
          <Button onClick={save} disabled={!dirty || draft.length === 0 || update.isPending}>
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

      {(error || update.isError) && (
        <p className="rounded-2xl border border-red-300/60 bg-red-50/40 px-4 py-3 text-sm text-red-600">
          {error ||
            (update.error instanceof ApiError ? update.error.message : "Could not save the time slots.")}
        </p>
      )}

      <GlassCard className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarClock className="size-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              Bookable slots{" "}
              <span className="ml-1 rounded-pill bg-primary/10 px-2.5 py-0.5 align-middle text-xs font-semibold text-primary">
                {draft.length}
              </span>
            </p>
            <p className="text-sm text-muted">
              Change a time, remove a slot, or add a new one. Slots are kept in time order. Existing bookings
              keep their slot even if you remove it.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading slots…
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {draft.map((slot, index) => (
              <div
                key={slot}
                className="flex items-center gap-2 rounded-2xl border border-line bg-surface/60 p-2.5 pl-3.5">
                <span className="flex-1 font-display text-base font-semibold text-ink">{slot}</span>
                <input
                  type="time"
                  value={to24h(slot)}
                  onChange={(e) => e.target.value && editSlot(index, e.target.value)}
                  aria-label={`Change ${slot}`}
                  className="h-9 w-[7.5rem] rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  disabled={draft.length <= 1}
                  aria-label={`Remove ${slot}`}
                  className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <div>
            <label htmlFor="newSlot" className="mb-1.5 block text-sm font-medium text-ink">
              Add a slot
            </label>
            <input
              id="newSlot"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50"
            />
          </div>
          <Button variant="outline" onClick={addSlot} disabled={!newTime || isLoading}>
            <Plus className="size-4" /> Add {newTime ? to12h(newTime) : "slot"}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Quick schedules</p>
          <p className="text-sm text-muted">
            Replace the list with a ready-made schedule, then save. Standard is the original 8 slots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={p.slots.length === 0}
              onClick={() => change(p.slots)}
              className={cn(
                "cursor-pointer rounded-2xl border px-4 py-2.5 text-left transition-colors disabled:opacity-50",
                sameList(draft, sortSlots(p.slots))
                  ? "border-primary bg-primary/10"
                  : "border-line hover:border-primary/40",
              )}>
              <span className="block text-sm font-medium text-ink">
                {p.label} · {p.slots.length} slots
              </span>
              <span className="block text-xs text-muted">{p.hint}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Saved slots reach the customer app within about 30 seconds. Off-peak pricing still follows the
          windows on the Off-Peak Hours page, so check those cover any new early or late slots you add.
        </p>
      </div>
    </div>
  );
}
