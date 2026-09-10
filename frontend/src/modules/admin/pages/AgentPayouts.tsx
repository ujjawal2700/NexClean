import { useState, useEffect } from "react";
import { Wallet, Percent, IndianRupee, Save, Loader2, Info, TriangleAlert } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { ApiError } from "@shared/lib/api";
import { usePayoutConfig, useUpdatePayoutConfig, usePricing, useVehicleCategories } from "../api/admin.api";
import type { PayoutConfig } from "../types";

/**
 * Mirrors backend/src/modules/payout/payoutConfig.service.ts `computePayout`.
 * Kept in step so the preview below shows exactly what a cleaner will be paid.
 */
function computePayout(price: number, rule: PayoutConfig): number {
  const base = rule.mode === "flat" ? rule.flatAmount : (price * rule.percent) / 100;
  let payout = Math.round(base);
  if (rule.minPayout > 0) payout = Math.max(payout, rule.minPayout);
  if (rule.maxPayout > 0) payout = Math.min(payout, rule.maxPayout);
  return Math.max(0, Math.min(payout, Math.round(price)));
}

type Draft = { mode: "percent" | "flat"; percent: string; flatAmount: string; minPayout: string; maxPayout: string };

const toDraft = (c: PayoutConfig): Draft => ({
  mode: c.mode,
  percent: String(c.percent),
  flatAmount: String(c.flatAmount),
  minPayout: String(c.minPayout),
  maxPayout: String(c.maxPayout),
});

const toRule = (d: Draft): PayoutConfig => ({
  mode: d.mode,
  percent: Number(d.percent) || 0,
  flatAmount: Number(d.flatAmount) || 0,
  minPayout: Number(d.minPayout) || 0,
  maxPayout: Number(d.maxPayout) || 0,
});

export function AgentPayouts() {
  const { data: config, isLoading } = usePayoutConfig();
  const { data: pricing } = usePricing();
  const { data: categories = [] } = useVehicleCategories();
  const update = useUpdatePayoutConfig();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setDraft(toDraft(config));
  }, [config]);

  if (isLoading || !draft) return <p className="text-muted">Loading payout settings…</p>;

  const rule = toRule(draft);
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const dirty = !!config && JSON.stringify(toRule(draft)) !== JSON.stringify(toRule(toDraft(config)));
  const capBelowFloor = rule.maxPayout > 0 && rule.maxPayout < rule.minPayout;
  const emptyRule = rule.mode === "flat" ? rule.flatAmount <= 0 : rule.percent <= 0;

  const save = () => {
    setError("");
    update.mutate(rule, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save the payout settings"),
    });
  };

  // Every live package priced against every vehicle category, so the admin can
  // see the real earnings spread before committing to a rule.
  const activeCategories = categories.filter((c) => c.active);
  const activePackages = (pricing?.packages ?? []).filter((p) => p.active);
  const previewRows = activePackages.map((pkg) => ({
    name: pkg.name,
    cells: activeCategories.map((cat) => {
      // Same rounding the catalog uses to turn a base price + factor into the
      // price a customer is actually charged.
      const base = pricing?.base?.[cat.key as keyof typeof pricing.base] ?? cat.basePrice ?? 0;
      const price = Math.round((base * pkg.factor) / 10) * 10;
      return { key: cat.key, price, payout: computePayout(price, rule) };
    }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Agent Payouts</h1>
          <p className="mt-1 text-sm text-muted">
            Set what a cleaner earns per completed job. Applies to every new and in-progress job the moment you save.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5">
          <Wallet className="size-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {rule.mode === "flat" ? `${formatMoney(rule.flatAmount)} per job` : `${rule.percent}% of job price`}
          </span>
        </div>
      </div>

      <GlassCard className="space-y-5">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Payout rule</p>
          <p className="mt-1 text-sm text-muted">
            Pick one rule for the whole fleet. The rest of the job price is the company's margin.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={draft.mode === "percent"}
            onClick={() => patch({ mode: "percent" })}
            icon={<Percent className="size-5" />}
            title="Percentage of job price"
            body="Earnings scale with the package and vehicle size. Best when prices vary a lot."
          />
          <ModeCard
            active={draft.mode === "flat"}
            onClick={() => patch({ mode: "flat" })}
            icon={<IndianRupee className="size-5" />}
            title="Flat amount per job"
            body="Every completed job pays the same, whatever it was sold for."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">Share of job price (%)</span>
            <Input
              name="percent"
              type="number"
              min="0"
              max="100"
              disabled={draft.mode !== "percent"}
              value={draft.percent}
              onChange={(e) => patch({ percent: e.target.value })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">Flat amount per job (₹)</span>
            <Input
              name="flatAmount"
              type="number"
              min="0"
              disabled={draft.mode !== "flat"}
              value={draft.flatAmount}
              onChange={(e) => patch({ flatAmount: e.target.value })}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">Minimum payout (₹)</span>
            <Input
              name="minPayout"
              type="number"
              min="0"
              value={draft.minPayout}
              onChange={(e) => patch({ minPayout: e.target.value })}
            />
            <span className="block text-[11px] text-muted">Floor for heavily discounted jobs. 0 = no floor.</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">Maximum payout (₹)</span>
            <Input
              name="maxPayout"
              type="number"
              min="0"
              value={draft.maxPayout}
              onChange={(e) => patch({ maxPayout: e.target.value })}
            />
            <span className="block text-[11px] text-muted">Cap on a single job. 0 = uncapped.</span>
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-muted/40 p-3 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p>
            Jobs already marked complete keep the amount they were finished at — changing this rule never rewrites
            past earnings. A payout is also never more than the job's own price.
          </p>
        </div>

        {(capBelowFloor || emptyRule) && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-50/60 p-3 text-xs text-amber-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>
              {capBelowFloor
                ? "The maximum payout is below the minimum — raise the cap or drop the floor."
                : "This rule pays cleaners ₹0 on every job. Set a value above zero before saving."}
            </p>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            {dirty ? "Unsaved changes" : saved ? "Saved" : "Settings are up to date"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => config && setDraft(toDraft(config))}
              disabled={!dirty || update.isPending}
            >
              Reset
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || capBelowFloor || emptyRule || update.isPending}>
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {update.isPending ? "Saving…" : "Save payout rule"}
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">What cleaners will earn</p>
          <p className="mt-1 text-sm text-muted">
            Live preview against your current package prices{dirty ? " (using the unsaved rule above)" : ""}.
          </p>
        </div>

        {previewRows.length === 0 || activeCategories.length === 0 ? (
          <p className="text-sm text-muted">Add vehicle categories and packages under Pricing to see a preview.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-4 font-semibold">Package</th>
                  {activeCategories.map((c) => (
                    <th key={c.key} className="pb-2 pr-4 font-semibold">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.name} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-ink">{row.name}</td>
                    {row.cells.map((cell) => (
                      <td key={cell.key} className="py-2.5 pr-4">
                        <span className="font-display font-semibold text-ink">{formatMoney(cell.payout)}</span>
                        <span className="ml-1.5 text-xs text-muted">of {formatMoney(cell.price)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary/50 bg-primary/5" : "border-line bg-surface hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          active ? "bg-primary/15 text-primary" : "bg-surface-muted text-muted",
        )}
      >
        {icon}
      </span>
      <span>
        <span className={cn("block font-display font-semibold", active ? "text-primary" : "text-ink")}>{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{body}</span>
      </span>
    </button>
  );
}
