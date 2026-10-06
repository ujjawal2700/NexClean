import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { BrandModelSelect, type VehicleSelection } from "../components/BrandModelSelect";
import {
  VehicleColorPicker,
  ColorChip,
  EMPTY_VEHICLE_COLOR,
  type VehicleColor,
} from "../components/VehicleColorPicker";
import { useMe, useCategoryLabel, useVehicleCategories } from "../api/queries";
import { useAddVehicle, useRemoveVehicle } from "../api/mutations";

export function Vehicles() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: categories = [] } = useVehicleCategories();
  const vehicles = me?.vehicles ?? [];
  const categoryLabel = useCategoryLabel();
  const categoryImageMap = new Map(categories.map((c) => [c.key, c.imageUrl]));

  const addVehicle = useAddVehicle();
  const removeVehicle = useRemoveVehicle();

  const [showVehicle, setShowVehicle] = useState(false);
  const [selection, setSelection] = useState<VehicleSelection | null>(null);
  const [vPlate, setVPlate] = useState("");
  const [vColor, setVColor] = useState<VehicleColor>(EMPTY_VEHICLE_COLOR);

  const saveVehicle = () => {
    if (!selection) return;
    addVehicle.mutate(
      {
        name: `${selection.brand} ${selection.model}`,
        type: selection.categoryKey,
        brand: selection.brand,
        model: selection.model,
        plate: vPlate.trim() || "—",
        color: vColor.color.trim() || undefined,
        colorHex: vColor.colorHex || undefined,
      },
      {
        onSuccess: () => {
          setSelection(null);
          setVPlate("");
          setVColor(EMPTY_VEHICLE_COLOR);
          setShowVehicle(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Your garage</h1>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Vehicles</p>
          <Button variant="ghost" size="sm" onClick={() => setShowVehicle((v) => !v)}>
            <Plus className="size-4" /> Add vehicle
          </Button>
        </div>

        {showVehicle && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2">
            <BrandModelSelect onResolved={setSelection} />
            <Input
              name="vplate"
              label="Vehicle number"
              placeholder="GJ 01 AB 1234"
              maxLength={20}
              value={vPlate}
              onChange={(e) => setVPlate(e.target.value.toUpperCase())}
            />
            <div className="sm:col-span-2">
              <VehicleColorPicker value={vColor} onChange={setVColor} idPrefix="garage" />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" onClick={saveVehicle} disabled={addVehicle.isPending || !selection}>
                Save vehicle
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="w-20 shrink-0">
                <CarSilhouette type={v.type} imageUrl={categoryImageMap.get(v.type)} uid={`prof-${v.id}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold text-ink">{v.name}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                  {categoryLabel(v.type)} · {v.plate}
                  {(v.color || v.colorHex) && (
                    <>
                      {" · "}
                      <ColorChip color={v.color} colorHex={v.colorHex} />
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => removeVehicle.mutate(v.id)}
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label={`Remove ${v.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {vehicles.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Car className="size-4" /> No vehicles yet.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
