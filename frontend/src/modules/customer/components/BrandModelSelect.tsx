import { useVehicleBrands } from "../api/queries";
import type { CarType } from "../types";

type Props = {
  type: CarType;
  brand: string;
  model: string;
  onBrandChange: (brand: string) => void;
  onModelChange: (model: string) => void;
};

const selectClass =
  "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50 disabled:opacity-50";

/** Vehicle type > brand > model picker. Type drives the brand list; pricing is always based on type alone. */
export function BrandModelSelect({ type, brand, model, onBrandChange, onModelChange }: Props) {
  const { data: brands = [], isLoading } = useVehicleBrands(type);
  const selectedBrand = brands.find((b) => b.name === brand);

  return (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Brand</label>
        <select
          value={brand}
          onChange={(e) => {
            onBrandChange(e.target.value);
            onModelChange("");
          }}
          className={selectClass}
        >
          <option value="">{isLoading ? "Loading…" : "Select brand"}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Model</label>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!selectedBrand}
          className={selectClass}
        >
          <option value="">{selectedBrand ? "Select model" : "Choose a brand first"}</option>
          {selectedBrand?.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
