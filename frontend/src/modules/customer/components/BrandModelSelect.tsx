import { useState } from "react";
import { useVehicleBrands, useVehicleModels, useVehicleCategories } from "../api/queries";

export type VehicleSelection = { brand: string; model: string; categoryKey: string };

type Props = {
  onResolved: (selection: VehicleSelection | null) => void;
};

const selectClass =
  "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50 disabled:opacity-50";

/**
 * Brand > model picker. The category is derived from whichever model is
 * picked (a brand spans many categories) and reported via onResolved — the
 * parent never has to ask the customer for a category directly. Falls back
 * to a manual name + category entry if their car isn't in the catalog yet.
 */
export function BrandModelSelect({ onResolved }: Props) {
  const { data: brands = [], isLoading: loadingBrands } = useVehicleBrands();
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const { data: models = [], isLoading: loadingModels } = useVehicleModels(brandId || null);

  const [manual, setManual] = useState(false);
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const { data: categories = [] } = useVehicleCategories();

  const selectedBrand = brands.find((b) => b.id === brandId);

  const pickBrand = (id: string) => {
    setBrandId(id);
    setModelId("");
    onResolved(null);
  };

  const pickModel = (id: string) => {
    setModelId(id);
    const model = models.find((m) => m.id === id);
    if (model && selectedBrand) onResolved({ brand: selectedBrand.name, model: model.name, categoryKey: model.categoryKey });
    else onResolved(null);
  };

  const updateManual = (patch: Partial<{ brand: string; model: string; category: string }>) => {
    const brand = patch.brand ?? manualBrand;
    const model = patch.model ?? manualModel;
    const category = patch.category ?? manualCategory;
    if (patch.brand !== undefined) setManualBrand(patch.brand);
    if (patch.model !== undefined) setManualModel(patch.model);
    if (patch.category !== undefined) setManualCategory(patch.category);
    if (brand.trim() && model.trim() && category) onResolved({ brand: brand.trim(), model: model.trim(), categoryKey: category });
    else onResolved(null);
  };

  if (manual) {
    return (
      <>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Brand</label>
          <input
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
            placeholder="e.g. Hyundai"
            value={manualBrand}
            onChange={(e) => updateManual({ brand: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Model</label>
          <input
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
            placeholder="e.g. Creta"
            value={manualModel}
            onChange={(e) => updateManual({ model: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Vehicle category</label>
          <select
            value={manualCategory}
            onChange={(e) => updateManual({ category: e.target.value })}
            className={selectClass}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setManual(false);
              onResolved(null);
            }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            Search the catalog instead
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Brand</label>
        <select value={brandId} onChange={(e) => pickBrand(e.target.value)} className={selectClass}>
          <option value="">{loadingBrands ? "Loading…" : "Select brand"}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Model</label>
        <select value={modelId} onChange={(e) => pickModel(e.target.value)} disabled={!brandId} className={selectClass}>
          <option value="">{!brandId ? "Choose a brand first" : loadingModels ? "Loading…" : "Select model"}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={() => {
            setManual(true);
            onResolved(null);
          }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Can't find your car? Enter it manually
        </button>
      </div>
    </>
  );
}
