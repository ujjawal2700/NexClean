import { useState } from "react";
import { Users, IndianRupee, Repeat, Plus, Trash2, Check, X } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { StatCard } from "../components/StatCard";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useVehicleCategories } from "../api/admin.api";
import type { AdminPlan, VehicleCategory, PlanPrices } from "../types";

type PriceDraft = Record<string, string>;

function emptyDraft(categories: VehicleCategory[]): PriceDraft {
  return Object.fromEntries(categories.map((c) => [c.key, ""]));
}

/** Turn a string price draft into numeric PlanPrices (blank/invalid → 0). */
function toPrices(draft: PriceDraft, categories: VehicleCategory[]): PlanPrices {
  return Object.fromEntries(categories.map((c) => [c.key, Number(draft[c.key]) || 0]));
}

function VehiclePriceInputs({
  categories,
  draft,
  onChange,
}: {
  categories: VehicleCategory[];
  draft: PriceDraft;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {categories.map((c) => (
        <label key={c.key} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3">
          <span className="text-sm text-muted">{c.name}</span>
          <span className="flex items-center gap-1">
            <span className="text-muted">₹</span>
            <input
              type="number"
              value={draft[c.key] ?? ""}
              onChange={(e) => onChange(c.key, e.target.value)}
              placeholder="0"
              className="h-9 w-24 bg-transparent text-right text-ink outline-none"
            />
          </span>
        </label>
      ))}
    </div>
  );
}

function PlanCard({ plan, categories }: { plan: AdminPlan; categories: VehicleCategory[] }) {
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [editing, setEditing] = useState(false);
  const [prices, setPrices] = useState<PriceDraft>(
    () => Object.fromEntries(categories.map((c) => [c.key, String(plan.prices[c.key] ?? "")])),
  );
  const [washes, setWashes] = useState(String(plan.washesPerMonth));

  const save = () => {
    update.mutate(
      { id: plan.id, prices: toPrices(prices, categories), washesPerMonth: Number(washes) || 0 },
      { onSuccess: () => setEditing(false) },
    );
  };

  const remove_ = () => {
    if (window.confirm(`Delete the "${plan.name}" plan? This can't be undone.`)) {
      remove.mutate(plan.id);
    }
  };

  return (
    <GlassCard className={plan.active ? "" : "opacity-60"}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl font-semibold text-ink">{plan.name}</p>
        {!editing && (
          <p className="font-display text-lg font-semibold text-primary">
            <span className="text-sm font-normal text-muted">from </span>
            {formatMoney(plan.price)}
            <span className="text-sm font-normal text-muted">/mo</span>
          </p>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <VehiclePriceInputs
            categories={categories}
            draft={prices}
            onChange={(key, value) => setPrices((p) => ({ ...p, [key]: value }))}
          />
          <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3">
            <span className="text-sm text-muted">Washes / month (-1 = unlimited)</span>
            <input
              type="number"
              value={washes}
              onChange={(e) => setWashes(e.target.value)}
              className="h-9 w-16 bg-transparent text-right text-ink outline-none"
            />
          </label>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="font-display text-3xl font-semibold text-ink">{plan.subscribers}</p>
              <p className="text-sm text-muted">subscribers</p>
            </div>
            <p className="text-sm font-medium text-muted">
              {plan.washesPerMonth < 0 ? "Unlimited" : `${plan.washesPerMonth}/mo`} washes
            </p>
          </div>

          <dl className="mt-4 space-y-1 border-t border-line/70 pt-4 text-sm">
            {categories.map((c) => (
              <div key={c.key} className="flex justify-between">
                <dt className="text-muted">{c.name}</dt>
                <dd className="font-medium text-ink">{formatMoney(plan.prices[c.key] ?? 0)}/mo</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <div className="mt-4 flex gap-2 border-t border-line/70 pt-4">
        {editing ? (
          <>
            <Button size="sm" className="flex-1" disabled={update.isPending} onClick={save}>
              <Check className="size-4" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: plan.id, active: !plan.active })}
            >
              {plan.active ? "Deactivate" : "Activate"}
            </Button>
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={remove_}>
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function NewPlanForm({ categories, onClose }: { categories: VehicleCategory[]; onClose: () => void }) {
  const create = useCreatePlan();
  const [name, setName] = useState("");
  const [washes, setWashes] = useState("");
  const [prices, setPrices] = useState<PriceDraft>(() => emptyDraft(categories));

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), prices: toPrices(prices, categories), washesPerMonth: Number(washes) || 0 },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <GlassCard>
      <p className="font-display text-lg font-semibold text-ink">New plan</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Name" placeholder="Gold" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          name="washesPerMonth"
          label="Washes / month (-1 = unlimited)"
          type="number"
          placeholder="6"
          value={washes}
          onChange={(e) => setWashes(e.target.value)}
        />
      </div>
      <p className="mt-5 mb-2 text-sm font-medium text-ink">Monthly price per vehicle category</p>
      <VehiclePriceInputs categories={categories} draft={prices} onChange={(key, value) => setPrices((p) => ({ ...p, [key]: value }))} />
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>
          <Check className="size-4" /> Create plan
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </GlassCard>
  );
}

export function Plans() {
  const { data: plans = [] } = usePlans();
  const { data: categories = [] } = useVehicleCategories();
  const [adding, setAdding] = useState(false);

  const activePlans = plans.filter((p) => p.active);
  const totalSubs = plans.reduce((s, p) => s + p.subscribers, 0);
  const mrr = plans.reduce((s, p) => s + p.subscribers * p.price, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Subscriptions</h1>
          <p className="mt-1 text-muted">Recurring revenue across all plans.</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New plan
          </Button>
        )}
      </div>

      {adding && <NewPlanForm categories={categories} onClose={() => setAdding(false)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total subscribers" value={totalSubs.toLocaleString("en-IN")} />
        <StatCard icon={IndianRupee} label="Monthly recurring revenue" value={formatMoney(mrr)} delta="8.2%" trend="up" />
        <StatCard icon={Repeat} label="Active plans" value={String(activePlans.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} categories={categories} />
        ))}
        {plans.length === 0 && <p className="text-muted">No plans yet — create one above.</p>}
      </div>
    </div>
  );
}
