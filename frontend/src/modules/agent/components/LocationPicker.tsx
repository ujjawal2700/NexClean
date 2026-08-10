import { MapPin, Building2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Input } from "@shared/ui/Input";
import type { PublicCity, PublicZone } from "@modules/customer/api/public";

/**
 * City → area dropdowns for agent signup.
 *
 * Replaces a free-text "area / society" box. That field was typed by hand, so
 * the same society arrived as half a dozen spellings, and everything that reads
 * it — area alerts, the admin's agent filters — compares on the string. Picking
 * from the admin's Locations list makes those comparisons actually work.
 *
 * Dropdowns rather than a row of pills: the list is admin-managed and grows, and
 * a wrapping pill grid gets unusable at a dozen societies on a phone. A native
 * <select> also gets the platform's own picker, search-by-typing and screen
 * reader handling for free.
 *
 * Values are the city and area NAMES, not ids, matching what the rest of the
 * app already stores and displays.
 *
 * Falls back to a free-text input when no cities are configured, so a fresh
 * deployment can't lock cleaners out of signing up entirely.
 */
export function LocationPicker({
  cities,
  zones,
  citiesLoading,
  zonesLoading,
  city,
  area,
  onCity,
  onArea,
}: {
  cities: PublicCity[];
  zones: PublicZone[];
  citiesLoading: boolean;
  zonesLoading: boolean;
  city: string;
  area: string;
  onCity: (city: string) => void;
  onArea: (area: string) => void;
}) {
  if (citiesLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading locations…
      </div>
    );
  }

  if (cities.length === 0) {
    return (
      <Input
        name="area"
        autoComplete="address-level2"
        label="Area / society you'll operate in"
        placeholder="Green Valley Society"
        leading={<MapPin className="size-4" />}
        value={area}
        onChange={(e) => onArea(e.target.value)}
      />
    );
  }

  const noAreasYet = Boolean(city) && !zonesLoading && zones.length === 0;

  return (
    <div className="space-y-4">
      <Select
        name="city"
        label="City you'll work in"
        icon={<MapPin className="size-4" />}
        value={city}
        placeholder="Select your city"
        onChange={onCity}
        options={cities.map((c) => c.name)}
      />

      <Select
        name="area"
        label="Area you'll operate in"
        icon={<Building2 className="size-4" />}
        value={area}
        placeholder={city ? (zonesLoading ? "Loading areas…" : "Select your area") : "Choose a city first"}
        disabled={!city || zonesLoading || zones.length === 0}
        onChange={onArea}
        options={zones.map((z) => z.name)}
        hint={noAreasYet ? `No areas listed for ${city} yet — continue and an admin will assign yours.` : undefined}
      />
    </div>
  );
}

/** Native select dressed to match the Input control used elsewhere on this form. */
function Select({
  name,
  label,
  icon,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  hint,
}: {
  name: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="w-full">
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 transition-colors",
          "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
          disabled && "opacity-60",
        )}
      >
        <span className="flex-shrink-0 text-muted">{icon}</span>
        <select
          id={name}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 w-full appearance-none bg-transparent text-ink outline-none",
            // A native select shows its first option as the value, so an unset
            // control must look like the Input placeholder rather than real text.
            !value && "text-muted/70",
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-ink">
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="size-4 flex-shrink-0 text-muted" />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
