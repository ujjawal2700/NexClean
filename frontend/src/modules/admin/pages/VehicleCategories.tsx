import { useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import {
  useVehicleCategories,
  useCreateVehicleCategory,
  useUpdateVehicleCategory,
  useDeleteVehicleCategory,
} from "../api/admin.api";
import type { VehicleCategory } from "../types";

function CategoryCard({ category }: { category: VehicleCategory }) {
  const update = useUpdateVehicleCategory();
  const remove = useDeleteVehicleCategory();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [basePrice, setBasePrice] = useState(String(category.basePrice));

  const save = () => {
    update.mutate(
      { id: category.id, name: name.trim() || category.name, basePrice: Number(basePrice) || category.basePrice },
      { onSuccess: () => setEditing(false) },
    );
  };

  const remove_ = () => {
    if (window.confirm(`Delete the "${category.name}" category? This can't be undone.`)) {
      remove.mutate(category.id);
    }
  };

  return (
    <GlassCard className={category.active ? "" : "opacity-60"}>
      <div className="mb-2 h-14">
        <CarSilhouette type={category.key} uid={`cat-${category.key}`} className="mx-auto h-full w-auto" />
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input name={`name-${category.id}`} label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/50">
            <span className="text-muted">₹</span>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="h-10 w-full bg-transparent text-ink outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={update.isPending} onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-center font-display text-lg font-semibold text-ink">{category.name}</p>
          <p className="text-center text-sm text-muted">{formatMoney(category.basePrice)} base price</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: category.id, active: !category.active })}
            >
              {category.active ? "Active" : "Inactive"}
            </Button>
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={remove_}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function NewCategoryForm({ onClose }: { onClose: () => void }) {
  const create = useCreateVehicleCategory();
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");

  const submit = () => {
    if (!name.trim() || !basePrice) return;
    create.mutate(
      { name: name.trim(), basePrice: Number(basePrice) || 0 },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <GlassCard>
      <p className="font-display text-lg font-semibold text-ink">New category</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input name="catName" label="Name" placeholder="Convertible" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          name="catPrice"
          label="Base price"
          type="number"
          placeholder="599"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        This price is wired into Pricing and every existing plan automatically — nothing's left unconfigured.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={create.isPending || !name.trim() || !basePrice}>
          <Plus className="size-4" /> Create category
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </GlassCard>
  );
}

export function VehicleCategories() {
  const { data: categories = [] } = useVehicleCategories();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Vehicle Categories</h1>
          <p className="mt-1 text-muted">
            The top-level categories (Hatchback, SUV, ...) that pricing and plans are based on.
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New category
          </Button>
        )}
      </div>

      {adding && <NewCategoryForm onClose={() => setAdding(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <CategoryCard key={c.id} category={c} />
        ))}
        {categories.length === 0 && (
          <GlassCard className="flex items-center gap-2 py-12 text-center text-muted sm:col-span-2 lg:col-span-4">
            <Layers className="size-4" /> No categories yet — create one above.
          </GlassCard>
        )}
      </div>
    </div>
  );
}
