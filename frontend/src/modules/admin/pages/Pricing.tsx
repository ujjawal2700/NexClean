import { useState, useEffect } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import { usePricing, useUpdatePricing } from "../api/admin.api";
import { VEHICLE_LABEL, VEHICLE_TYPES, type Pricing as PricingType, type PricingPackage } from "../types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function Pricing() {
  const { data: serverPricing } = usePricing();
  const update = useUpdatePricing();
  const [draft, setDraft] = useState<PricingType | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (serverPricing) setDraft({ base: serverPricing.base, packages: serverPricing.packages });
  }, [serverPricing]);

  if (!draft) {
    return <p className="text-muted">Loading pricing…</p>;
  }

  const setBase = (type: string, value: number) =>
    setDraft((d) => (d ? { ...d, base: { ...d.base, [type]: value } } : d));
  const patchPackage = (id: string, patch: Partial<PricingPackage>) =>
    setDraft((d) => (d ? { ...d, packages: d.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : d));
  const removePackage = (id: string) =>
    setDraft((d) => (d ? { ...d, packages: d.packages.filter((p) => p.id !== id) } : d));
  const addPackage = () =>
    setDraft((d) => {
      if (!d) return d;
      let name = "New package";
      let id = slugify(name);
      let i = 1;
      while (d.packages.some((p) => p.id === id)) {
        i += 1;
        name = `New package ${i}`;
        id = slugify(name);
      }
      return { ...d, packages: [...d.packages, { id, name, factor: 1, durationMinutes: null, active: true }] };
    });

  const save = () => {
    update.mutate(draft, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Pricing</h1>
        <p className="mt-1 text-muted">Set base prices per vehicle and package multipliers.</p>
      </div>

      <GlassCard>
        <p className="font-display text-lg font-semibold text-ink">Base price by vehicle</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VEHICLE_TYPES.map((t) => (
            <div key={t} className="rounded-2xl border border-line bg-surface/60 p-4">
              <div className="mb-2 h-14">
                <CarSilhouette type={t} uid={`price-${t}`} className="mx-auto h-full w-auto" />
              </div>
              <p className="text-center text-sm font-medium text-ink">{VEHICLE_LABEL[t]}</p>
              <div className="mt-3 flex items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/50">
                <span className="text-muted">₹</span>
                <input
                  type="number"
                  value={draft.base[t] ?? 0}
                  onChange={(e) => setBase(t, Number(e.target.value) || 0)}
                  className="h-10 w-full bg-transparent text-ink outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-ink">Service packages</p>
            <p className="mt-1 text-sm text-muted">Final price = base × multiplier (rounded to ₹10).</p>
          </div>
          <Button variant="outline" size="sm" onClick={addPackage}>
            <Plus className="size-4" /> Add package
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {draft.packages.map((p) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 ${p.active === false ? "opacity-50" : ""}`}
            >
              <div className="min-w-40 flex-1 space-y-1">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => patchPackage(p.id, { name: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface px-2 font-display font-semibold text-ink outline-none focus:border-primary/50"
                />
                <p className="text-xs text-muted">
                  e.g. Sedan → {formatMoney(Math.round(((draft.base.sedan ?? 0) * p.factor) / 10) * 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">×</span>
                <input
                  type="number"
                  step="0.1"
                  value={p.factor}
                  onChange={(e) => patchPackage(p.id, { factor: Number(e.target.value) || 0 })}
                  className="h-10 w-20 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={p.durationMinutes ?? ""}
                  placeholder="min"
                  onChange={(e) =>
                    patchPackage(p.id, { durationMinutes: e.target.value ? Number(e.target.value) : null })
                  }
                  className="h-10 w-20 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-primary/50"
                />
                <span className="text-xs text-muted">min</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => patchPackage(p.id, { active: p.active === false })}
              >
                {p.active === false ? "Inactive" : "Active"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removePackage(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {draft.packages.length === 0 && <p className="text-sm text-muted">No packages — add one above.</p>}
        </div>
      </GlassCard>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? (<><Check className="size-4" /> Saved</>) : "Save pricing"}
        </Button>
        <p className="text-xs text-muted">Applies to new bookings immediately.</p>
      </div>
    </div>
  );
}
