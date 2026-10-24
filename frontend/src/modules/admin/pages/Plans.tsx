import { useState } from "react";
import { Users, IndianRupee, Repeat, Plus, Trash2, Check, X } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { StatCard } from "../components/StatCard";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, usePlanOptions } from "../api/admin.api";
import type { AdminPlan, VehicleCategory, Pricing, PlanDetails } from "../types";

const MAX_KEY_POINTS = 12;
const EMPTY_DETAILS: PlanDetails = { tagline: "", description: "", keyPoints: [] };

/** Trim the copy and drop blank key points before sending it to the server. */
function cleanDetails(d: PlanDetails): PlanDetails {
  return {
    tagline: d.tagline.trim(),
    description: d.description.trim(),
    keyPoints: d.keyPoints.map((k) => k.trim()).filter(Boolean),
  };
}

/**
 * The customer-facing copy for a plan: a one-line tagline, a longer
 * description and bullet key points. Shown on the customer's plan card and
 * plan detail page.
 */
function PlanDetailsFields({ value, onChange }: { value: PlanDetails; onChange: (next: PlanDetails) => void }) {
  const [point, setPoint] = useState("");

  const addPoint = () => {
    const text = point.trim();
    if (!text || value.keyPoints.length >= MAX_KEY_POINTS) return;
    onChange({ ...value, keyPoints: [...value.keyPoints, text] });
    setPoint("");
  };

  const editPoint = (index: number, text: string) =>
    onChange({ ...value, keyPoints: value.keyPoints.map((k, i) => (i === index ? text : k)) });

  const removePoint = (index: number) =>
    onChange({ ...value, keyPoints: value.keyPoints.filter((_, i) => i !== index) });

  return (
    <div className="space-y-3">
      <Input
        name="tagline"
        label="Tagline"
        placeholder="e.g. Our most popular plan."
        maxLength={120}
        value={value.tagline}
        onChange={(e) => onChange({ ...value, tagline: e.target.value })}
      />
      <div>
        <label htmlFor="planDescription" className="mb-1.5 block text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="planDescription"
          rows={4}
          maxLength={2000}
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="What the plan includes, who it's for, and anything customers should know."
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
        />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">
          Key points <span className="font-normal text-muted">({value.keyPoints.length}/{MAX_KEY_POINTS})</span>
        </p>
        <div className="space-y-2">
          {value.keyPoints.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" />
              <input
                value={k}
                maxLength={120}
                onChange={(e) => editPoint(i, e.target.value)}
                aria-label={`Key point ${i + 1}`}
                className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => removePoint(i)}
                aria-label={`Remove key point ${i + 1}`}
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-red-500/10 hover:text-red-600">
                <X className="size-4" />
              </button>
            </div>
          ))}
          {value.keyPoints.length < MAX_KEY_POINTS && (
            <div className="flex items-center gap-2">
              <input
                value={point}
                maxLength={120}
                onChange={(e) => setPoint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPoint();
                  }
                }}
                placeholder="e.g. Free rescheduling"
                aria-label="New key point"
                className="h-10 flex-1 rounded-xl border border-dashed border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
              />
              <Button type="button" size="sm" variant="outline" onClick={addPoint} disabled={!point.trim()}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type FormProps = {
  plan?: AdminPlan;
  categories: VehicleCategory[];
  pricing?: Pricing;
  onClose: () => void;
};

function PlanForm({ plan, categories, pricing, onClose }: FormProps) {
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const [details, setDetails] = useState<PlanDetails>(() => ({ tagline: plan?.tagline ?? EMPTY_DETAILS.tagline, description: plan?.description ?? EMPTY_DETAILS.description, keyPoints: plan?.keyPoints ?? [] }));
  const [name, setName] = useState(plan?.name ?? "");
  const [washes, setWashes] = useState(plan ? String(plan.washesPerMonth) : "");
  const [packageId, setPackageId] = useState(plan?.packageId ?? "");
  const [discount, setDiscount] = useState(String(plan?.discountPercentage ?? 0));
  const pkg = pricing?.packages.find((p) => p.id === packageId && p.active !== false);
  const count = Number(washes);
  const percentage = Number(discount);
  const valid = !!name.trim() && Number.isSafeInteger(count) && count > 0 && discount.trim() !== "" &&
    Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 && !!pkg &&
    Number.isFinite(pkg.factor) && pkg.factor > 0 && categories.length > 0 && categories.every((c) => {
      const base = pricing?.base[c.key];
      return base != null && Number.isFinite(base) && base > 0 && Math.round(base * pkg.factor / 10) * 10 > 0 &&
        Number.isFinite(base * pkg.factor * count);
    });
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const prefix = plan ? `plan-${plan.id}` : "new-plan";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const input = { name: name.trim(), packageId, washesPerMonth: count, discountPercentage: percentage, ...cleanDetails(details) };
    if (plan) update.mutate({ id: plan.id, ...input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id={`${prefix}-name`} name="name" label="Name" placeholder="Basic" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input id={`${prefix}-washes`} name="washesPerMonth" label="Washes / month" type="number" min={1} step={1} required placeholder="4" value={washes} onChange={(e) => setWashes(e.target.value)} />
        <div>
          <label htmlFor={`${prefix}-package`} className="mb-1.5 block text-sm font-medium text-ink">Wash type</label>
          <select id={`${prefix}-package`} name="packageId" value={packageId} required onChange={(e) => setPackageId(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-surface px-3 text-ink">
            <option value="">Select a wash package</option>
            {packageId && !pkg && <option value={packageId} disabled>Previously selected package (unavailable)</option>}
            {pricing?.packages.filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Input id={`${prefix}-discount`} name="discountPercentage" label="Discount (%)" type="number" min={0} max={100} step="any" required value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </div>
      {!pricing && <p className="text-sm text-muted">Pricing is unavailable. Load Pricing before saving a plan.</p>}
      {pricing && !pricing.packages.some((p) => p.active !== false) && <p className="text-sm text-muted">Add an active wash package in Pricing first.</p>}
      {plan && !plan.packageId && <p className="text-sm text-muted">Choose a wash type and discount to calculate this plan’s monthly prices.</p>}
      {count < 0 && <p className="text-sm text-muted">Automatic pricing requires a positive monthly wash count.</p>}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Monthly price per vehicle category</p>
        <p className="mb-3 text-xs text-muted">Package price per wash × washes per month × (1 − discount / 100). Prices are calculated automatically and saved with the plan.</p>
        <dl className="space-y-2">
          {categories.map((c) => {
            const perWash = pricing && pkg ? Math.round((pricing.base[c.key] ?? 0) * pkg.factor / 10) * 10 : 0;
            const total = perWash * count;
            const effective = Math.round(total * (1 - percentage / 100) * 100) / 100;
            return (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                <dt className="text-sm text-muted">{c.name}</dt>
                <dd className="text-right text-sm">
                  {valid ? <><span className="block text-xs text-muted">{formatMoney(perWash)} × {count} = {formatMoney(total)} · {percentage}% off</span><output aria-label={`${c.name} monthly price`} className="font-semibold text-ink">{formatMoney(effective)}/mo</output></> : <span className="text-muted">Complete the plan details</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <PlanDetailsFields value={details} onChange={setDetails} />
      {error && <p role="alert" className="text-sm text-red-500">{error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !valid}><Check className="size-4" /> {plan ? "Save" : "Create plan"}</Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function PlanCard({ plan, categories, pricing }: { plan: AdminPlan; categories: VehicleCategory[]; pricing?: Pricing }) {
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [editing, setEditing] = useState(false);
  const pkg = pricing?.packages.find((p) => p.id === plan.packageId);
  const error = update.error ?? remove.error;

  return (
    <GlassCard className={plan.active ? "" : "opacity-60"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-xl font-semibold text-ink">{plan.name}</p>
        {!editing && <p className="font-display text-lg font-semibold text-primary"><span className="text-sm font-normal text-muted">from </span>{formatMoney(plan.price)}<span className="text-sm font-normal text-muted">/mo</span></p>}
      </div>
      {editing ? <PlanForm plan={plan} categories={categories} pricing={pricing} onClose={() => setEditing(false)} /> : <>
        {plan.tagline && <p className="mt-1 text-sm text-muted">{plan.tagline}</p>}
        <div className="mt-5 flex items-end justify-between">
          <div><p className="font-display text-3xl font-semibold text-ink">{plan.subscribers}</p><p className="text-sm text-muted">subscribers</p></div>
          <p className="text-sm font-medium text-muted">{plan.washesPerMonth < 0 ? "Unlimited" : `${plan.washesPerMonth}/mo`} washes</p>
        </div>
        {plan.packageId && <p className="mt-3 text-sm text-muted">{pkg?.name ?? plan.packageId} · {plan.discountPercentage ?? 0}% off</p>}
        <dl className="mt-4 space-y-1 border-t border-line/70 pt-4 text-sm">
          {categories.map((c) => <div key={c.key} className="flex justify-between"><dt className="text-muted">{c.name}</dt><dd className="font-medium text-ink">{formatMoney(plan.prices[c.key] ?? 0)}/mo</dd></div>)}
        </dl>
        {(plan.keyPoints?.length > 0 || plan.description) && (
          <div className="mt-4 space-y-2 border-t border-line/70 pt-4 text-sm">
            <ul className="space-y-1.5">{plan.keyPoints?.map((point, i) => <li key={i} className="flex gap-2 text-ink-soft"><Check className="size-4 shrink-0 text-primary" />{point}</li>)}</ul>
            {plan.description && <p className="line-clamp-3 text-muted">{plan.description}</p>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-500">{error.message}</p>}
        <div className="mt-4 flex gap-2 border-t border-line/70 pt-4">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: plan.id, active: !plan.active })}>{plan.active ? "Deactivate" : "Activate"}</Button>
          <Button size="sm" variant="ghost" aria-label={`Delete ${plan.name}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete the "${plan.name}" plan? This can't be undone.`)) remove.mutate(plan.id); }}><Trash2 className="size-4" /></Button>
        </div>
      </>}
    </GlassCard>
  );
}

export function Plans() {
  const { data: plans = [] } = usePlans();
  const { data: options } = usePlanOptions();
  const categories = options?.categories ?? [];
  const pricing = options?.pricing;
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

      {adding && <GlassCard><p className="font-display text-lg font-semibold text-ink">New plan</p><PlanForm categories={categories} pricing={pricing} onClose={() => setAdding(false)} /></GlassCard>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total subscribers" value={totalSubs.toLocaleString("en-IN")} />
        <StatCard icon={IndianRupee} label="Monthly recurring revenue" value={formatMoney(mrr)} delta="8.2%" trend="up" />
        <StatCard icon={Repeat} label="Active plans" value={String(activePlans.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} categories={categories} pricing={pricing} />
        ))}
        {plans.length === 0 && <p className="text-muted">No plans yet — create one above.</p>}
      </div>
    </div>
  );
}
