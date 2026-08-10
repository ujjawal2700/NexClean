import { MapPin, Building2, Loader2 } from "lucide-react";
import { Input } from "@shared/ui/Input";
import type { PublicCity, PublicZone } from "@modules/customer/api/public";

/**
 * City → area picker for agent signup.
 *
 * Replaces a free-text "area / society" box. That field was typed by hand, so
 * the same society arrived as half a dozen spellings, and everything that reads
 * it — area alerts, the admin's agent filters — compares on the string. Picking
 * from the admin's Locations list makes those comparisons actually work.
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

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">City you'll work in</p>
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={city === c.name}
              onClick={() => onCity(c.name)}
              className={cn(city === c.name)}
            >
              <MapPin className="size-3.5" /> {c.name}
            </button>
          ))}
        </div>
      </div>

      {city && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Area you'll operate in</p>
          {zonesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading areas…
            </div>
          ) : zones.length === 0 ? (
            <p className="text-xs text-muted">
              No areas listed for {city} yet — you can continue, and an admin will assign yours.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  aria-pressed={area === z.name}
                  onClick={() => onArea(z.name)}
                  className={cn(area === z.name)}
                >
                  <Building2 className="size-3.5" /> {z.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Shared pill styling — selected pills read as chosen, not merely hovered. */
function cn(selected: boolean): string {
  return [
    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
    selected
      ? "border-primary bg-primary/10 text-primary"
      : "border-line bg-surface/60 text-ink hover:border-primary/50",
  ].join(" ");
}
