import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { BrandModelSelect } from "../components/BrandModelSelect";
import { useMe } from "../api/queries";
import { useAddVehicle, useRemoveVehicle } from "../api/mutations";
import { VEHICLE_LABEL, VEHICLE_TYPES } from "../data/catalog";
import type { CarType } from "../types";

export function Vehicles() {
  const { data: me } = useMe();
  const vehicles = me?.vehicles ?? [];

  const addVehicle = useAddVehicle();
  const removeVehicle = useRemoveVehicle();

  const [showVehicle, setShowVehicle] = useState(false);
  const [vType, setVType] = useState<CarType>("sedan");
  const [vBrand, setVBrand] = useState("");
  const [vModel, setVModel] = useState("");
  const [vPlate, setVPlate] = useState("");

  const saveVehicle = () => {
    if (!vBrand || !vModel) return;
    addVehicle.mutate(
      { name: `${vBrand} ${vModel}`, type: vType, brand: vBrand, model: vModel, plate: vPlate.trim() || "—" },
      {
        onSuccess: () => {
          setVBrand("");
          setVModel("");
          setVPlate("");
          setVType("sedan");
          setShowVehicle(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/profile" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> Profile
        </Link>
        <h1 className="font-display text-3xl text-ink">Your garage</h1>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Vehicles</p>
          <Button variant="ghost" size="sm" onClick={() => setShowVehicle((v) => !v)}>
            <Plus className="size-4" /> Add vehicle
          </Button>
        </div>

        {showVehicle && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
              <select
                value={vType}
                onChange={(e) => {
                  setVType(e.target.value as CarType);
                  setVBrand("");
                  setVModel("");
                }}
                className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VEHICLE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <BrandModelSelect type={vType} brand={vBrand} model={vModel} onBrandChange={setVBrand} onModelChange={setVModel} />
            <Input name="vplate" label="Plate" placeholder="GJ 01 AB 1234" value={vPlate} onChange={(e) => setVPlate(e.target.value)} />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button size="sm" onClick={saveVehicle} disabled={addVehicle.isPending || !vBrand || !vModel}>
                Save vehicle
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="w-20 shrink-0">
                <CarSilhouette type={v.type} uid={`prof-${v.id}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold text-ink">{v.name}</p>
                <p className="text-sm text-muted">
                  {VEHICLE_LABEL[v.type]} · {v.plate}
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
