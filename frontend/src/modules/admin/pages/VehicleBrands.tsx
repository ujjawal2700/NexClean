import { useState } from "react";
import { Plus, Trash2, X, Car } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import {
  useVehicleBrands,
  useCreateVehicleBrand,
  useUpdateVehicleBrand,
  useDeleteVehicleBrand,
  useVehicleModels,
  useCreateVehicleModel,
  useUpdateVehicleModel,
  useDeleteVehicleModel,
  useVehicleCategories,
} from "../api/admin.api";
import type { VehicleBrand } from "../types";

function ModelRows({ brand }: { brand: VehicleBrand }) {
  const { data: models = [] } = useVehicleModels(brand.id);
  const { data: categories = [] } = useVehicleCategories();
  const create = useCreateVehicleModel();
  const update = useUpdateVehicleModel();
  const remove = useDeleteVehicleModel();

  const [name, setName] = useState("");
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");

  const categoryName = (key: string) => categories.find((c) => c.key === key)?.name ?? key;

  const submit = () => {
    if (!name.trim() || !categoryKey) return;
    create.mutate(
      { brandId: brand.id, name: name.trim(), categoryKey },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <div className="mt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          name={`model-${brand.id}`}
          placeholder="e.g. Creta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <select
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={submit} disabled={create.isPending || !name.trim() || !categoryKey}>
          <Plus className="size-4" /> Add model
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {models.map((m) => (
          <span
            key={m.id}
            className={`flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm ${
              m.active ? "border-line bg-surface/60 text-ink" : "border-line bg-surface/30 text-muted line-through"
            }`}
          >
            {m.name}
            <span className="text-xs text-muted">· {categoryName(m.categoryKey)}</span>
            <button
              onClick={() => update.mutate({ brandId: brand.id, modelId: m.id, active: !m.active })}
              disabled={update.isPending}
              className="text-muted hover:text-primary"
              aria-label={m.active ? `Deactivate ${m.name}` : `Activate ${m.name}`}
            >
              {m.active ? "•" : "○"}
            </button>
            <button
              onClick={() => remove.mutate({ brandId: brand.id, modelId: m.id })}
              disabled={remove.isPending}
              aria-label={`Remove ${m.name}`}
              className="text-muted hover:text-red-500"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {models.length === 0 && <p className="text-sm text-muted">No models added yet.</p>}
      </div>
    </div>
  );
}

export function VehicleBrands() {
  const { data: brands = [] } = useVehicleBrands();
  const create = useCreateVehicleBrand();
  const update = useUpdateVehicleBrand();
  const remove = useDeleteVehicleBrand();
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Vehicle Brands</h1>
        <p className="mt-1 text-muted">
          Manage car brands and their models. Each model carries its own category — a brand like Hyundai can span
          Hatchback, Sedan and SUV models all at once.
        </p>
      </div>

      <GlassCard>
        <div className="flex items-center gap-2">
          <Car className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">Add a brand</p>
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            name="brandName"
            placeholder="e.g. Hyundai"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={create.isPending || !name.trim()}>
            <Plus className="size-4" /> Add brand
          </Button>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {brands.map((b) => (
          <GlassCard key={b.id}>
            <div className="flex items-center justify-between gap-2">
              <p className={`font-display text-lg font-semibold ${b.active ? "text-ink" : "text-muted line-through"}`}>
                {b.name}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: b.id, active: !b.active })}
                >
                  {b.active ? "Active" : "Inactive"}
                </Button>
                <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(b.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <ModelRows brand={b} />
          </GlassCard>
        ))}
        {brands.length === 0 && (
          <GlassCard className="py-12 text-center text-muted lg:col-span-2">No brands yet. Add one above.</GlassCard>
        )}
      </div>
    </div>
  );
}
