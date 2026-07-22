import { useState } from "react";
import { Plus, Trash2, MapPin, Building2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
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
  const [cityName, setCityName] = useState("");

  const submit = () => {
    const val = cityName.trim();
    if (!val) return;
    create.mutate(
      { name: val },
      {
        onSuccess: () => setCityName(""),
      },
    );
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Cities</p>
      </div>
      <p className="mt-1 text-sm text-muted">Disabling a city marks it unavailable for service.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted">City Name</label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type city name (e.g. Bengaluru)"
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-primary/50"
          />
        </div>
        <div className="flex flex-col">
          <span className="hidden sm:block mb-1.5 text-xs font-medium opacity-0 select-none">Action</span>
          <Button
            onClick={submit}
            disabled={create.isPending || !cityName.trim()}
            className="h-12 rounded-2xl px-5 shrink-0"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {cities.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5"
          >
            <p className={`text-sm font-medium ${c.active ? "text-ink" : "text-muted line-through"}`}>
              {c.name}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: c.id, active: !c.active })}
              >
                {c.active ? "Active" : "Inactive"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(c.id)}
              >
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
  const [zoneName, setZoneName] = useState("");
  const [cityId, setCityId] = useState("");

  const submit = () => {
    const val = zoneName.trim();
    if (!val || !cityId) return;
    create.mutate(
      { name: val, cityId },
      {
        onSuccess: () => setZoneName(""),
      },
    );
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Service zones</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Areas/societies grouped by city. Used to assign agents to a service area.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted">Service Zone / Society</label>
          <input
            type="text"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={cityId ? "Type zone / society name" : "Select a city first"}
            disabled={!cityId}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-primary/50 disabled:opacity-50"
          />
          {!cityId && <p className="mt-1.5 text-xs text-muted">Please select a city first</p>}
        </div>
        <div className="sm:w-48">
          <label className="mb-1.5 block text-xs font-medium text-muted">City</label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50 disabled:opacity-50"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <span className="hidden sm:block mb-1.5 text-xs font-medium opacity-0 select-none">Action</span>
          <Button
            onClick={submit}
            disabled={create.isPending || !zoneName.trim() || !cityId}
            className="h-12 rounded-2xl px-5 shrink-0"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {zones.map((z) => (
          <div
            key={z.id}
            className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5"
          >
            <div>
              <p className={`text-sm font-medium ${z.active ? "text-ink" : "text-muted line-through"}`}>
                {z.name}
              </p>
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
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(z.id)}
              >
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
