import { useState } from "react";
import { Users, IndianRupee, Repeat, Plus, Trash2, Check, X } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { StatCard } from "../components/StatCard";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from "../api/admin.api";
import type { AdminPlan } from "../types";

type Draft = { name: string; price: string; washesPerMonth: string };
const EMPTY_DRAFT: Draft = { name: "", price: "", washesPerMonth: "" };

function PlanCard({ plan }: { plan: AdminPlan }) {
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(plan.price));
  const [washes, setWashes] = useState(String(plan.washesPerMonth));

  const save = () => {
    update.mutate(
      { id: plan.id, price: Number(price) || 0, washesPerMonth: Number(washes) || 0 },
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
        {editing ? (
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface px-2">
            <span className="text-muted">₹</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-9 w-20 bg-transparent text-right text-ink outline-none"
            />
          </div>
        ) : (
          <p className="font-display text-lg font-semibold text-primary">
            {formatMoney(plan.price)}
            <span className="text-sm font-normal text-muted">/mo</span>
          </p>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="font-display text-3xl font-semibold text-ink">{plan.subscribers}</p>
          <p className="text-sm text-muted">subscribers</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <input
              type="number"
              value={washes}
              onChange={(e) => setWashes(e.target.value)}
              className="h-9 w-16 rounded-xl border border-line bg-surface px-2 text-right text-ink outline-none focus:border-primary/50"
            />
            washes/mo
          </div>
        ) : (
          <p className="text-sm font-medium text-muted">
            {plan.washesPerMonth < 0 ? "Unlimited" : `${plan.washesPerMonth}/mo`} washes
          </p>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        Contributing <span className="font-medium text-ink">{formatMoney(plan.subscribers * plan.price)}</span> / month
      </p>

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

function NewPlanForm({ onClose }: { onClose: () => void }) {
  const create = useCreatePlan();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const submit = () => {
    if (!draft.name.trim()) return;
    create.mutate(
      { name: draft.name.trim(), price: Number(draft.price) || 0, washesPerMonth: Number(draft.washesPerMonth) || 0 },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <GlassCard>
      <p className="font-display text-lg font-semibold text-ink">New plan</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          name="name"
          label="Name"
          placeholder="Gold"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <Input
          name="price"
          label="Price / month"
          type="number"
          placeholder="1499"
          value={draft.price}
          onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
        />
        <Input
          name="washesPerMonth"
          label="Washes / month (-1 = unlimited)"
          type="number"
          placeholder="6"
          value={draft.washesPerMonth}
          onChange={(e) => setDraft((d) => ({ ...d, washesPerMonth: e.target.value }))}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={create.isPending || !draft.name.trim()}>
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

      {adding && <NewPlanForm onClose={() => setAdding(false)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total subscribers" value={totalSubs.toLocaleString("en-IN")} />
        <StatCard icon={IndianRupee} label="Monthly recurring revenue" value={formatMoney(mrr)} delta="8.2%" trend="up" />
        <StatCard icon={Repeat} label="Active plans" value={String(activePlans.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
        {plans.length === 0 && <p className="text-muted">No plans yet — create one above.</p>}
      </div>
    </div>
  );
}
