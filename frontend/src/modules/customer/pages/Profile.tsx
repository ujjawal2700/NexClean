import { useState, useEffect } from "react";
import { Car, MapPin, Trash2, Plus, User, Phone, Check } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { useMe } from "../api/queries";
import {
  useUpdateProfile,
  useAddVehicle,
  useRemoveVehicle,
  useAddAddress,
  useRemoveAddress,
} from "../api/mutations";
import { VEHICLE_LABEL, VEHICLE_TYPES } from "../data/catalog";
import type { CarType } from "../types";

export function Profile() {
  const { data: me } = useMe();
  const vehicles = me?.vehicles ?? [];
  const addresses = me?.addresses ?? [];

  const updateProfile = useUpdateProfile();
  const addVehicle = useAddVehicle();
  const removeVehicle = useRemoveVehicle();
  const addAddress = useAddAddress();
  const removeAddress = useRemoveAddress();

  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me?.name) setDisplayName(me.name);
  }, [me?.name]);

  const [showVehicle, setShowVehicle] = useState(false);
  const [vName, setVName] = useState("");
  const [vType, setVType] = useState<CarType>("sedan");
  const [vPlate, setVPlate] = useState("");

  const [showAddr, setShowAddr] = useState(false);
  const [aLabel, setALabel] = useState("");
  const [aLine, setALine] = useState("");

  const saveName = () => {
    updateProfile.mutate(displayName.trim() || "NexClean Member", {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
    });
  };

  const saveVehicle = () => {
    if (!vName.trim()) return;
    addVehicle.mutate(
      { name: vName.trim(), type: vType, plate: vPlate.trim() || "—" },
      {
        onSuccess: () => {
          setVName("");
          setVPlate("");
          setVType("sedan");
          setShowVehicle(false);
        },
      },
    );
  };

  const saveAddress = () => {
    if (!aLabel.trim() || !aLine.trim()) return;
    addAddress.mutate(
      { label: aLabel.trim(), line: aLine.trim(), society: aLine.trim() },
      {
        onSuccess: () => {
          setALabel("");
          setALine("");
          setShowAddr(false);
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-ink">Profile</h1>

      {/* account */}
      <GlassCard>
        <p className="font-display text-lg font-semibold text-ink">Account</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            name="name"
            label="Full name"
            leading={<User className="size-4" />}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            name="phone"
            label="Mobile number"
            leading={<Phone className="size-4" />}
            value={me?.phone ?? ""}
            disabled
          />
        </div>
        <Button className="mt-4" size="sm" onClick={saveName} disabled={updateProfile.isPending}>
          {saved ? (
            <>
              <Check className="size-4" /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </GlassCard>

      {/* garage */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Your garage</p>
          <Button variant="ghost" size="sm" onClick={() => setShowVehicle((v) => !v)}>
            <Plus className="size-4" /> Add vehicle
          </Button>
        </div>

        {showVehicle && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-3">
            <Input name="vname" label="Name" placeholder="e.g. Honda City" value={vName} onChange={(e) => setVName(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value as CarType)}
                className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VEHICLE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <Input name="vplate" label="Plate" placeholder="GJ 01 AB 1234" value={vPlate} onChange={(e) => setVPlate(e.target.value)} />
            <div className="sm:col-span-3">
              <Button size="sm" onClick={saveVehicle} disabled={addVehicle.isPending}>
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

      {/* addresses */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Saved addresses</p>
          <Button variant="ghost" size="sm" onClick={() => setShowAddr((v) => !v)}>
            <Plus className="size-4" /> Add address
          </Button>
        </div>

        {showAddr && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2">
            <Input name="alabel" label="Label" placeholder="Home / Office" value={aLabel} onChange={(e) => setALabel(e.target.value)} />
            <Input name="aline" label="Address" placeholder="Flat, society, area" value={aLine} onChange={(e) => setALine(e.target.value)} />
            <div className="sm:col-span-2">
              <Button size="sm" onClick={saveAddress} disabled={addAddress.isPending}>
                Save address
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-ink">{a.label}</p>
                <p className="truncate text-sm text-muted">{a.line}</p>
              </div>
              <button
                onClick={() => removeAddress.mutate(a.id)}
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label={`Remove ${a.label}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <MapPin className="size-4" /> No addresses yet.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
