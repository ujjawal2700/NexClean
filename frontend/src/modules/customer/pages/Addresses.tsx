import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useMe } from "../api/queries";
import { useAddAddress, useRemoveAddress } from "../api/mutations";

export function Addresses() {
  const { data: me } = useMe();
  const addresses = me?.addresses ?? [];

  const addAddress = useAddAddress();
  const removeAddress = useRemoveAddress();

  const [showAddr, setShowAddr] = useState(false);
  const [aLabel, setALabel] = useState("");
  const [aLine, setALine] = useState("");

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
    <div className="space-y-6">
      <div>
        <Link to="/app/profile" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> Profile
        </Link>
        <h1 className="font-display text-3xl text-ink">Saved addresses</h1>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">Addresses</p>
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
