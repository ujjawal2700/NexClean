import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Trash2, Pencil, Home, Briefcase, Navigation } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useMe } from "../api/queries";
import { useRemoveAddress } from "../api/mutations";
import { AddAddressModal } from "@shared/components/address/AddAddressModal";
import type { Address } from "../types";

function getLabelIcon(label: string) {
  const l = label.toLowerCase();
  if (l === "home") return Home;
  if (l === "office" || l === "work") return Briefcase;
  return MapPin;
}

export function Addresses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: me } = useMe();
  const addresses = me?.addresses ?? [];

  const removeAddress = useRemoveAddress();
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get("add") === "true");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingAddress(null);
    if (searchParams.get("add")) {
      searchParams.delete("add");
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Saved addresses</h1>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">My Addresses</p>
            <p className="text-xs text-muted">Manage your service locations with exact map coordinates</p>
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)} data-testid="open-add-address">
            <Plus className="size-4" /> Add new address
          </Button>
        </div>

        <div className="space-y-3 pt-2">
          {addresses.map((a) => {
            const Icon = getLabelIcon(a.label);
            const coords = a.coordinates;
            const hasCoords = coords && coords.length === 2;

            return (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold text-ink">{a.label}</p>
                      {hasCoords && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          <Navigation className="size-2.5" /> GPS Pinned ({coords[1].toFixed(4)}, {coords[0].toFixed(4)})
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted break-words">{a.line}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingAddress(a)}
                    className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
                    aria-label={`Edit ${a.label}`}
                    data-testid={`edit-address-${a.id}`}
                    title="Edit address"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => removeAddress.mutate(a.id)}
                    className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                    aria-label={`Remove ${a.label}`}
                    data-testid={`remove-address-${a.id}`}
                    title="Delete address"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {addresses.length === 0 && (
            <div className="py-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-muted text-muted">
                <MapPin className="size-6" />
              </div>
              <p className="mt-3 font-display font-semibold text-ink">No saved addresses yet</p>
              <p className="mt-1 text-xs text-muted">Pin your car's location on the map to get started.</p>
              <Button size="sm" className="mt-4" onClick={() => setShowAddModal(true)}>
                <Plus className="size-4" /> Add your first address
              </Button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Add / Edit Address Modal with Interactive Map Pinning */}
      {(showAddModal || editingAddress) && (
        <AddAddressModal
          editingAddress={editingAddress}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
