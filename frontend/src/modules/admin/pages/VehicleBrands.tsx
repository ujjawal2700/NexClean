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
  useAddVehicleModel,
  useRemoveVehicleModel,
} from "../api/admin.api";
import type { VehicleBrand } from "../types";

function ModelChips({ brand }: { brand: VehicleBrand }) {
  const addModel = useAddVehicleModel();
  const removeModel = useRemoveVehicleModel();
  const [model, setModel] = useState("");

  const submit = () => {
    if (!model.trim()) return;
    addModel.mutate({ id: brand.id, model: model.trim() }, { onSuccess: () => setModel("") });
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Input
          name={`model-${brand.id}`}
          placeholder="e.g. Creta"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button size="sm" onClick={submit} disabled={addModel.isPending || !model.trim()}>
          <Plus className="size-4" /> Add model
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {brand.models.map((m) => (
          <span
            key={m}
            className="flex items-center gap-1.5 rounded-pill border border-line bg-surface/60 px-3 py-1 text-sm text-ink"
          >
            {m}
            <button
              onClick={() => removeModel.mutate({ id: brand.id, model: m })}
              disabled={removeModel.isPending}
              aria-label={`Remove ${m}`}
              className="text-muted hover:text-red-500"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {brand.models.length === 0 && <p className="text-sm text-muted">No models added yet.</p>}
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
        <p className="mt-1 text-muted">Manage car brands and the specific models customers can select.</p>
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
            <ModelChips brand={b} />
          </GlassCard>
        ))}
        {brands.length === 0 && (
          <GlassCard className="py-12 text-center text-muted lg:col-span-2">No brands yet. Add one above.</GlassCard>
        )}
      </div>
    </div>
  );
}
