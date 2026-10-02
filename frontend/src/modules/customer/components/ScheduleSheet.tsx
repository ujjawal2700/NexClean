import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, Plus, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { useScrollLock } from "@shared/lib/scrollLock";

/**
 * Pieces of the subscription "schedule / reschedule a wash" sheet.
 *
 * A bottom sheet on phones (thumb-reachable, full width) and a centred dialog
 * from `sm` up. Solid surface on purpose: the translucent GlassCard this
 * replaced turned grey and washed-out over the dark backdrop.
 */

export function ScheduleSheet({
  title,
  subtitle,
  error,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Freeze the page behind the sheet (Lenis + iOS-proof).
  useScrollLock();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-2xl sm:max-h-[88dvh] sm:max-w-lg sm:rounded-[28px]"
      >
        {/* Grab handle — signals "sheet" on phones. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>

        <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-3 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl font-semibold text-ink sm:text-2xl">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-muted text-ink-soft transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-600"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 wrap-anywhere">{error}</span>
            </div>
          )}
          {children}
        </div>

        <footer className="border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
          {footer}
        </footer>
      </section>
    </div>
  );
}

export function SheetSection({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {step}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Radio-style card list — full text visible, unlike a native <select>. */
export function OptionList<T extends { id: string }>({
  items,
  value,
  onChange,
  icon: Icon,
  render,
  emptyText,
  addLabel,
  addTo,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  icon: typeof Check;
  render: (item: T) => { title: string; detail?: string };
  emptyText: string;
  addLabel: string;
  addTo: string;
}) {
  if (items.length === 0) {
    return (
      <Link
        to={addTo}
        className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm transition-colors hover:bg-primary/10"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Plus className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-primary">{addLabel}</span>
          <span className="block text-muted">{emptyText}</span>
        </span>
      </Link>
    );
  }

  return (
    <div role="radiogroup" className="space-y-2">
      {items.map((item) => {
        const selected = item.id === value;
        const { title, detail } = render(item);
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-line bg-surface hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                selected ? "bg-primary text-white" : "bg-surface-muted text-ink-soft",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink wrap-anywhere">{title}</span>
              {detail && <span className="mt-0.5 line-clamp-2 block text-xs text-muted wrap-anywhere">{detail}</span>}
            </span>
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border-2",
                selected ? "border-primary bg-primary text-white" : "border-line",
              )}
              aria-hidden
            >
              {selected && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const sameDay = (a: string, b: Date) => !!a && new Date(a).toDateString() === b.toDateString();

/** Horizontally scrolling day picker; keeps the chosen day in view. */
export function DateStrip({
  dates,
  value,
  onChange,
}: {
  dates: Date[];
  value: string;
  onChange: (iso: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="-mx-5 sm:-mx-6">
      <div className="flex snap-x gap-2 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {dates.map((d) => {
          const selected = sameDay(value, d);
          const isTomorrow = d.toDateString() === tomorrow.toDateString();
          return (
            <button
              key={d.toISOString()}
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-pressed={selected}
              aria-label={d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => onChange(d.toISOString())}
              className={cn(
                "flex w-[4.25rem] shrink-0 cursor-pointer snap-start flex-col items-center rounded-2xl border py-2.5 transition-colors",
                selected
                  ? "border-primary bg-primary text-white shadow-md shadow-primary/25"
                  : "border-line bg-surface text-ink hover:border-primary/40",
              )}
            >
              <span className={cn("text-[11px] font-medium uppercase", selected ? "text-white/80" : "text-muted")}>
                {isTomorrow ? "Tmrw" : d.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
              <span className="font-display text-lg font-semibold leading-tight">{d.getDate()}</span>
              <span className={cn("text-[11px]", selected ? "text-white/80" : "text-muted")}>
                {d.toLocaleDateString("en-IN", { month: "short" })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SlotGrid({
  slots,
  value,
  onChange,
}: {
  slots: readonly string[];
  value: string;
  onChange: (slot: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => {
        const selected = value === slot;
        return (
          <button
            key={slot}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(slot)}
            className={cn(
              "min-h-11 cursor-pointer rounded-xl border px-1 text-[13px] font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-white shadow-md shadow-primary/25"
                : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-ink",
            )}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

/** "Sat, 3 Oct · 09:30 AM" — the footer's running summary of the pick. */
export function describeSchedule(date: string, slot: string): string | null {
  if (!date) return null;
  const day = new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return slot ? `${day} · ${slot}` : day;
}
