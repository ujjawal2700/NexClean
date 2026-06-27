import { useState, useRef } from "react";
import { Plus, Trash2, MapPin, Building2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { usePlacesAutocomplete } from "@shared/hooks/usePlacesAutocomplete";
import {
  useCities,
  useZones,
  useCreateCity,
  useUpdateCity,
  useDeleteCity,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
} from "../api/admin.api";

function CitiesPanel() {
  const { data: cities = [] } = useCities();
  const create = useCreateCity();
  const update = useUpdateCity();
  const remove = useDeleteCity();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete({
    inputRef,
    types: ["(cities)"],
    onSelect: (placeName) => {
      const cityOnly = placeName.split(",")[0].trim();
      setName(cityOnly);
    },
  });

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Cities</p>
      </div>
      <p className="mt-1 text-sm text-muted">Disabling a city marks it unavailable for service.</p>

      <div className="mt-4 flex gap-2">
        <Input
          ref={inputRef}
          name="cityName"
          placeholder="Search and select city (e.g. Bengaluru)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {cities.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5"
          >
            <p className={`text-sm font-medium ${c.active ? "text-ink" : "text-muted line-through"}`}>{c.name}</p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: c.id, active: !c.active })}
              >
                {c.active ? "Active" : "Inactive"}
              </Button>
              <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(c.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {cities.length === 0 && <p className="text-sm text-muted">No cities yet.</p>}
      </div>
    </GlassCard>
  );
}

function ZonesPanel() {
  const { data: cities = [] } = useCities();
  const { data: zones = [] } = useZones();
  const create = useCreateZone();
  const update = useUpdateZone();
  const remove = useDeleteZone();
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCity = cities.find((c) => c.id === cityId);

  usePlacesAutocomplete({
    inputRef,
    types: ["geocode", "establishment"],
    cityName: selectedCity?.name,
    onSelect: (placeName) => {
      const zoneOnly = placeName.split(",")[0].trim();
      setName(zoneOnly);
    },
  });

  const submit = () => {
    if (!name.trim() || !cityId) return;
    create.mutate({ name: name.trim(), cityId }, { onSuccess: () => setName("") });
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Service zones</p>
      </div>
      <p className="mt-1 text-sm text-muted">Areas/societies grouped by city. Used to assign agents to a service area.</p>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="mb-1 text-xs font-medium text-muted">Service Zone / Society</p>
          <Input
            ref={inputRef}
            name="zoneName"
            placeholder="Search location (e.g. Indiranagar)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!cityId}
            hint={!cityId ? "Please select a city first" : undefined}
          />
        </div>
        <div className="flex flex-col">
          <p className="mb-1.5 text-xs font-medium text-muted">City</p>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="h-12 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={submit}
          disabled={create.isPending || !name.trim() || !cityId}
          className="h-12 rounded-2xl"
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {zones.map((z) => (
          <div
            key={z.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5"
          >
            <div>
              <p className={`text-sm font-medium ${z.active ? "text-ink" : "text-muted line-through"}`}>{z.name}</p>
              <p className="text-xs text-muted">{z.cityName}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: z.id, active: !z.active })}
              >
                {z.active ? "Active" : "Inactive"}
              </Button>
              <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(z.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-sm text-muted">No zones yet.</p>}
      </div>
    </GlassCard>
  );
}


export function Locations() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Locations</h1>
        <p className="mt-1 text-muted">Manage serviceable cities and zones, and control availability.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CitiesPanel />
        <ZonesPanel />
      </div>
    </div>
  );
}
