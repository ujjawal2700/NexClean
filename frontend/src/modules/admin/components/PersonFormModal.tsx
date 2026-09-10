import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useZones } from "../api/admin.api";

export type PersonValues = {
  name: string;
  phone: string;
  email: string;
  area?: string;
  zoneId?: string | null;
};

/**
 * Create/edit dialog shared by the Agents and Customers pages.
 *
 * `withArea` is the only difference between the two, so both get identical
 * validation and error handling rather than two drifting copies. Rules mirror
 * the server (letters-only names, exactly 10 digits) so the common mistakes are
 * caught before a round trip — the server still validates regardless.
 */
export function PersonFormModal({
  open,
  title,
  submitLabel,
  initial,
  withArea = false,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: Partial<PersonValues>;
  withArea?: boolean;
  pending: boolean;
  error?: string;
  onSubmit: (values: PersonValues) => void;
  onClose: () => void;
}) {
  const { data: zones = [] } = useZones();
  const [values, setValues] = useState<PersonValues>({
    name: "",
    phone: "",
    email: "",
    area: "",
    zoneId: null,
  });
  const [touched, setTouched] = useState(false);

  // Re-seed whenever the dialog opens, so "edit" always starts from the row's
  // current values and "create" always starts empty.
  useEffect(() => {
    if (!open) return;
    setValues({
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      area: initial?.area ?? "",
      zoneId: initial?.zoneId ?? null,
    });
    setTouched(false);
  }, [
    open,
    initial?.name,
    initial?.phone,
    initial?.email,
    initial?.area,
    initial?.zoneId,
  ]);

  if (!open) return null;

  const nameOk = /^[\p{L}\p{M}\s.'-]{2,60}$/u.test(values.name.trim());
  const phoneOk = /^\d{10}$/.test(values.phone.trim());
  const emailOk =
    !values.email.trim() ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
  const valid = nameOk && phoneOk && emailOk;

  const submit = () => {
    setTouched(true);
    if (!valid || pending) return;
    onSubmit({
      ...values,
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <Input
            name="personName"
            label="Full name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            error={
              touched && !nameOk
                ? "Letters only, at least 2 characters"
                : undefined
            }
          />
          <Input
            name="personPhone"
            label="Mobile number"
            inputMode="numeric"
            maxLength={10}
            value={values.phone}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              }))
            }
            error={
              touched && !phoneOk ? "Must be exactly 10 digits" : undefined
            }
          />
          <Input
            name="personEmail"
            label="Email (optional)"
            type="email"
            value={values.email}
            onChange={(e) =>
              setValues((v) => ({ ...v, email: e.target.value }))
            }
            error={
              touched && !emailOk ? "Enter a valid email address" : undefined
            }
          />
          {withArea && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Service Zone (Geofence)
                </label>
                <select
                  value={values.zoneId || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = zones.find((z) => z.id === selectedId);
                    setValues((v) => ({
                      ...v,
                      zoneId: selectedId || null,
                      area: found ? found.name : v.area,
                    }));
                  }}
                  className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50">
                  <option value="">Select a service zone (optional)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.cityName})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                name="personArea"
                label="Area / society name (display)"
                value={values.area ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, area: e.target.value }))
                }
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation for a destructive action, with the server's reason surfaced. */
export function ConfirmDeleteModal({
  open,
  name,
  kind,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name: string;
  kind: "agent" | "customer";
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
        <h2 className="font-display text-xl text-ink">Delete {kind}?</h2>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-ink">{name}</span> will be removed
          permanently. This can't be undone.
        </p>
        <p className="mt-2 text-sm text-muted">
          Accounts with bookings or payments can't be deleted — suspend them
          instead, which blocks all access and keeps the records intact.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-red-500 text-white hover:bg-red-600 focus-visible:outline-red-500">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
