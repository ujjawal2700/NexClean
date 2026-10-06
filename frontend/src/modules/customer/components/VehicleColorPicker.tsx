import { Check, Pipette } from "lucide-react";
import { cn } from "@shared/lib/utils";

export type VehicleColor = { color: string; colorHex: string };

export const EMPTY_VEHICLE_COLOR: VehicleColor = { color: "", colorHex: "" };

/** The common car colours, one tap each. Anything else goes through the custom picker. */
const SWATCHES: { name: string; hex: string }[] = [
  { name: "White", hex: "#f5f5f4" },
  { name: "Black", hex: "#111111" },
  { name: "Silver", hex: "#c0c4c8" },
  { name: "Grey", hex: "#6b7280" },
  { name: "Red", hex: "#c81e1e" },
  { name: "Blue", hex: "#1d4ed8" },
  { name: "Brown", hex: "#6b4226" },
  { name: "Beige", hex: "#d6c3a1" },
  { name: "Green", hex: "#166534" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Orange", hex: "#ea580c" },
];

/**
 * Colour swatches, a custom colour picker and an editable colour name
 * ("Pearl White"), so the cleaner can spot the car. Used when adding a vehicle
 * to the garage and on the booking flow's vehicle step.
 */
export function VehicleColorPicker({
  value,
  onChange,
  idPrefix = "vehicle",
}: {
  value: VehicleColor;
  onChange: (next: VehicleColor) => void;
  idPrefix?: string;
}) {
  const hex = value.colorHex.toLowerCase();
  const preset = SWATCHES.find((s) => s.hex === hex);
  const isCustom = !!hex && !preset;

  /** Swapping swatches renames the colour, unless the customer typed their own name. */
  const pick = (nextHex: string, name?: string) => {
    const typedOwnName = value.color && !SWATCHES.some((s) => s.name === value.color);
    onChange({ colorHex: nextHex, color: typedOwnName ? value.color : (name ?? "") });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">Colour</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vehicle colour">
        {SWATCHES.map((s) => {
          const selected = s.hex === hex;
          return (
            <button
              key={s.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={s.name}
              title={s.name}
              onClick={() => pick(s.hex, s.name)}
              className={cn(
                "grid size-9 cursor-pointer place-items-center rounded-full border transition-transform hover:scale-105",
                selected ? "border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-surface" : "border-line",
              )}
              style={{ backgroundColor: s.hex }}>
              {selected && (
                <Check
                  className="size-4"
                  style={{ color: ["White", "Silver", "Beige", "Yellow"].includes(s.name) ? "#111" : "#fff" }}
                />
              )}
            </button>
          );
        })}

        {/* Custom colour: the native picker sits invisibly over the swatch. */}
        <label
          title="Pick a custom colour"
          className={cn(
            "relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border transition-transform hover:scale-105",
            isCustom ? "border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-surface" : "border-line",
          )}
          style={
            isCustom
              ? { backgroundColor: hex }
              : { background: "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)" }
          }>
          <Pipette className="size-4 text-white drop-shadow" />
          <input
            id={`${idPrefix}-color-custom`}
            type="color"
            value={hex || "#888888"}
            onChange={(e) => pick(e.target.value.toLowerCase())}
            aria-label="Pick a custom colour"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
        <span
          className="size-5 shrink-0 rounded-full border border-line"
          style={{ backgroundColor: hex || "transparent" }}
          aria-hidden
        />
        <input
          id={`${idPrefix}-color-name`}
          value={value.color}
          maxLength={30}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          placeholder="Colour name, e.g. Pearl White"
          aria-label="Colour name"
          className="h-12 w-full bg-transparent text-ink outline-none placeholder:text-muted/70"
        />
      </div>
    </div>
  );
}

/** A small dot + name for showing a saved colour in lists. */
export function ColorChip({ color, colorHex }: { color?: string; colorHex?: string }) {
  if (!color && !colorHex) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {colorHex && (
        <span className="size-3 shrink-0 rounded-full border border-line" style={{ backgroundColor: colorHex }} aria-hidden />
      )}
      {color || "Custom colour"}
    </span>
  );
}
