import { useEffect, useState, type ReactNode } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useVehicleCategories, useCities, useZones } from "../api/admin.api";

export type AgentStatus = "verified" | "pending" | "unverified" | "suspended";

export type PersonValues = {
  name: string;
  phone: string;
  email: string;
  // Agent-only
  city?: string;
  area?: string;
  agentStatus?: AgentStatus;
  aadharNumber?: string;
  rating?: number;
  // Customer-only
  status?: "active" | "suspended";
  address?: { label?: string; line?: string; society?: string };
  vehicle?: { type?: string; name?: string; plate?: string };
};

/**
 * What the caller can hand in to prefill. Deliberately looser than
 * PersonValues: `status` means the verification state on an agent record and
 * the account state on a customer one, and the list endpoints return neither
 * addresses nor vehicles.
 */
export type PersonInitial = {
  name?: string;
  phone?: string;
  email?: string;
  area?: string;
  city?: string;
  aadharNumber?: string;
  rating?: number;
  status?: string;
  agentStatus?: string;
  address?: { label?: string; line?: string; society?: string };
  vehicle?: { type?: string; name?: string; plate?: string };
  addresses?: { label?: string; line?: string; society?: string }[];
  vehicles?: { type?: string; name?: string; plate?: string }[];
};

const AGENT_STATUS_OPTIONS: {
  value: AgentStatus;
  label: string;
  hint: string;
}[] = [
  { value: "verified", label: "Verified", hint: "Can take jobs" },
  // The Agents list deliberately excludes pending cleaners — they queue on the
  // Agent Verification page — so say so, or they look like they vanished.
  {
    value: "pending",
    label: "Pending review",
    hint: "Queues under Agent Verification, not the Agents list",
  },
  { value: "unverified", label: "Unverified", hint: "Has not submitted KYC" },
  { value: "suspended", label: "Suspended", hint: "Blocked from signing in" },
];

const selectClass =
  "h-11 w-full rounded-2xl border border-line bg-surface px-3 text-ink outline-none transition-colors focus:border-primary/50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Visual grouping for the optional blocks, so the dialog reads as sections. */
function Fieldset({
  legend,
  note,
  children,
}: {
  legend: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-line/70 p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
        {legend}
      </legend>
      {note && <p className="mb-2 text-xs text-muted">{note}</p>}
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

/**
 * Create/edit dialog shared by the Agents and Customers pages and their detail
 * views. `kind` decides which half of the record is editable — everything else
 * (validation, error surfacing, the pending state) is deliberately identical so
 * the two roles can't drift apart.
 *
 * Rules mirror the server (letters-only names, exactly 10 digits, 12-digit
 * Aadhaar) so the common mistakes are caught before a round trip; the server
 * still validates regardless.
 */
export function PersonFormModal({
  open,
  kind,
  title,
  submitLabel,
  initial,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  kind: "agent" | "customer";
  title: string;
  submitLabel: string;
  initial?: PersonInitial;
  pending: boolean;
  error?: string;
  onSubmit: (values: PersonValues) => void;
  onClose: () => void;
}) {
  const isAgent = kind === "agent";
  const { data: categories = [] } = useVehicleCategories();
  const { data: cities = [] } = useCities();
  const { data: allZones = [] } = useZones();

  const [values, setValues] = useState<PersonValues>({
    name: "",
    phone: "",
    email: "",
  });
  const [touched, setTouched] = useState(false);

  // Re-seed whenever the dialog opens, so "edit" always starts from the record's
  // current values and "create" always starts empty. The list endpoints don't
  // carry addresses/vehicles, only the detail one does — a blank block means
  // "leave it alone" server-side, so an edit from the list can't wipe them.
  useEffect(() => {
    if (!open) return;
    const address = initial?.address ?? initial?.addresses?.[0];
    const vehicle = initial?.vehicle ?? initial?.vehicles?.[0];
    setValues({
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      city: initial?.city ?? "",
      area: initial?.area ?? "",
      agentStatus: (initial?.agentStatus ??
        initial?.status ??
        "verified") as AgentStatus,
      aadharNumber: initial?.aadharNumber ?? "",
      rating:
        initial?.rating !== undefined ? Number(initial.rating) : undefined,
      status: initial?.status === "suspended" ? "suspended" : "active",
      address: {
        label: address?.label ?? "",
        line: address?.line ?? "",
        society: address?.society ?? "",
      },
      vehicle: {
        type: vehicle?.type ?? "",
        name: vehicle?.name ?? "",
        plate: vehicle?.plate ?? "",
      },
    });
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    initial?.name,
    initial?.phone,
    initial?.email,
    initial?.rating,
  ]);

  if (!open) return null;

  const set = <K extends keyof PersonValues>(key: K, value: PersonValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Zones are stored against a city id; the form works in names.
  const cityZones = allZones.filter((z) => z.cityName === values.city);

  const nameOk = /^[\p{L}\p{M}\s.'-]{2,60}$/u.test(values.name.trim());
  const phoneOk = /^\d{10}$/.test(values.phone.trim());
  const emailOk =
    !values.email.trim() ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
  const aadharOk =
    !values.aadharNumber?.trim() || /^\d{12}$/.test(values.aadharNumber.trim());
  const ratingOk =
    values.rating === undefined || (values.rating >= 0 && values.rating <= 5);
  const valid =
    nameOk && phoneOk && emailOk && (!isAgent || (aadharOk && ratingOk));

  const submit = () => {
    setTouched(true);
    if (!valid || pending) return;
    const base = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    };
    onSubmit(
      isAgent
        ? {
            ...base,
            city: values.city?.trim() ?? "",
            area: values.area?.trim() ?? "",
            agentStatus: values.agentStatus,
            aadharNumber: values.aadharNumber?.trim() ?? "",
            rating:
              values.rating !== undefined ? Number(values.rating) : undefined,
          }
        : {
            ...base,
            status: values.status,
            address: values.address,
            vehicle: values.vehicle,
          },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-lift)]">
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
            onChange={(e) => set("name", e.target.value)}
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
              set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
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
            onChange={(e) => set("email", e.target.value)}
            error={
              touched && !emailOk ? "Enter a valid email address" : undefined
            }
          />

          {isAgent ? (
            <>
              {/* Picked from the admin's own Locations list rather than typed,
                  so agent records match what area alerts and filters compare on.
                  Falls back to a text box when no cities are configured yet. */}
              {cities.length === 0 ? (
                <Input
                  name="personArea"
                  label="Area / society (optional)"
                  value={values.area ?? ""}
                  onChange={(e) => set("area", e.target.value)}
                />
              ) : (
                <>
                  <Field label="City">
                    <select
                      name="personCity"
                      className={selectClass}
                      value={values.city ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          city: e.target.value,
                          area: "",
                        }))
                      }>
                      <option value="">Select a city…</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Area"
                    hint={
                      values.city && cityZones.length === 0
                        ? `No areas listed for ${values.city} yet.`
                        : undefined
                    }>
                    <select
                      name="personArea"
                      className={selectClass}
                      value={values.area ?? ""}
                      disabled={!values.city}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, area: e.target.value }));
                      }}>
                      <option value="">
                        {values.city
                          ? "Select an area…"
                          : "Choose a city first"}
                      </option>
                      {cityZones.map((z) => (
                        <option key={z.id} value={z.name}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              <Field
                label="Verification status"
                hint={
                  AGENT_STATUS_OPTIONS.find(
                    (o) => o.value === values.agentStatus,
                  )?.hint
                }>
                <select
                  name="personAgentStatus"
                  className={selectClass}
                  value={values.agentStatus}
                  onChange={(e) =>
                    set("agentStatus", e.target.value as AgentStatus)
                  }>
                  {AGENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Input
                name="personAadhar"
                label="Aadhaar number (optional)"
                inputMode="numeric"
                maxLength={12}
                value={values.aadharNumber ?? ""}
                onChange={(e) =>
                  set(
                    "aadharNumber",
                    e.target.value.replace(/\D/g, "").slice(0, 12),
                  )
                }
                error={
                  touched && !aadharOk ? "Must be exactly 12 digits" : undefined
                }
              />
              <Input
                name="personRating"
                label="Rating (0.0 - 5.0)"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={values.rating !== undefined ? values.rating : ""}
                onChange={(e) =>
                  set(
                    "rating",
                    e.target.value !== ""
                      ? parseFloat(e.target.value)
                      : undefined,
                  )
                }
                placeholder="e.g. 4.8"
                error={
                  touched && !ratingOk
                    ? "Rating must be between 0 and 5.0"
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <Field
                label="Account status"
                hint={
                  values.status === "suspended"
                    ? "Blocked from signing in"
                    : "Can book normally"
                }>
                <select
                  name="personStatus"
                  className={selectClass}
                  value={values.status}
                  onChange={(e) =>
                    set("status", e.target.value as "active" | "suspended")
                  }>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Field>

              <Fieldset
                legend="Address"
                note="Optional. Leave blank to keep whatever the customer already saved.">
                <Input
                  name="personAddressLabel"
                  label="Label"
                  placeholder="Home"
                  value={values.address?.label ?? ""}
                  onChange={(e) =>
                    set("address", { ...values.address, label: e.target.value })
                  }
                />
                <Input
                  name="personAddressLine"
                  label="Street address"
                  value={values.address?.line ?? ""}
                  onChange={(e) =>
                    set("address", { ...values.address, line: e.target.value })
                  }
                />
                <Input
                  name="personAddressSociety"
                  label="Society"
                  value={values.address?.society ?? ""}
                  onChange={(e) =>
                    set("address", {
                      ...values.address,
                      society: e.target.value,
                    })
                  }
                />
              </Fieldset>

              <Fieldset
                legend="Vehicle"
                note="Optional. Leave blank to keep whatever the customer already saved.">
                <Field label="Type">
                  <select
                    name="personVehicleType"
                    className={selectClass}
                    value={values.vehicle?.type ?? ""}
                    onChange={(e) =>
                      set("vehicle", {
                        ...values.vehicle,
                        type: e.target.value,
                      })
                    }>
                    <option value="">Select a type…</option>
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Input
                  name="personVehicleName"
                  label="Vehicle name"
                  placeholder="Swift VXi"
                  value={values.vehicle?.name ?? ""}
                  onChange={(e) =>
                    set("vehicle", { ...values.vehicle, name: e.target.value })
                  }
                />
                <Input
                  name="personVehiclePlate"
                  label="Number plate"
                  value={values.vehicle?.plate ?? ""}
                  onChange={(e) =>
                    set("vehicle", { ...values.vehicle, plate: e.target.value })
                  }
                />
              </Fieldset>
            </>
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
  onDeleteAgentOnly,
  onDeleteCustomerOnly,
  onDeletePersonOnly,
  onDeleteWithData,
  onClose,
}: {
  open: boolean;
  name: string;
  kind: "agent" | "customer";
  pending: boolean;
  error?: string;
  onConfirm?: () => void;
  onDeleteAgentOnly?: () => void;
  onDeleteCustomerOnly?: () => void;
  onDeletePersonOnly?: () => void;
  onDeleteWithData?: () => void;
  onClose: () => void;
}) {
  const [confirmStep, setConfirmStep] = useState<"only" | "with_data" | null>(
    null,
  );

  useEffect(() => {
    if (!open) setConfirmStep(null);
  }, [open]);

  if (!open) return null;

  const handleDeleteOnlyAction =
    onDeletePersonOnly ||
    (kind === "agent" ? onDeleteAgentOnly : onDeleteCustomerOnly);
  const isMultiOption = !!(handleDeleteOnlyAction || onDeleteWithData);
  const labelKind = kind === "agent" ? "Agent" : "Customer";

  const handleClose = () => {
    setConfirmStep(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        {/* Step 2: Confirmation for Delete Person Only */}
        {confirmStep === "only" ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 shrink-0">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Confirm: Delete {labelKind} Only?
                </h2>
                <p className="text-xs text-muted">Please confirm this action</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface-muted/50 p-4 text-xs text-ink-soft space-y-2 leading-relaxed">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-ink">{name}</span>?
              </p>
              <p>
                • The {kind} account will be deleted permanently and can no
                longer log in.
              </p>
              <p>
                • All historical bookings, payments, and receipts will be{" "}
                <strong>safely preserved</strong> and marked as{" "}
                <span className="font-semibold text-ink">
                  "{name} (deleted)"
                </span>
                .
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmStep(null)}
                  disabled={pending}>
                  Back
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={pending}>
                  Cancel
                </Button>
              </div>
              <button
                type="button"
                onClick={handleDeleteOnlyAction}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-xs sm:text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                data-testid={`confirm-delete-${kind}-only-btn`}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Yes, Delete {labelKind} Only
              </button>
            </div>
          </div>
        ) : confirmStep === "with_data" ? (
          /* Step 2: Confirmation for Delete with All Data */
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-red-500/10 text-red-600 shrink-0">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-red-600">
                  Confirm: Delete {labelKind} & All Data?
                </h2>
                <p className="text-xs text-muted">
                  Irreversible destructive action
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-700 space-y-2 leading-relaxed">
              <p className="font-semibold">
                ⚠️ Warning: You are about to permanently delete{" "}
                <span className="underline">{name}</span> AND ALL their assigned
                bookings, payments, and related records!
              </p>
              <p>
                • This will permanently remove all booking history, payments,
                and receipts associated with this {kind}.
              </p>
              <p>
                • This action <strong>cannot be undone</strong>.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmStep(null)}
                  disabled={pending}>
                  Back
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={pending}>
                  Cancel
                </Button>
              </div>
              <button
                type="button"
                onClick={onDeleteWithData}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-xs sm:text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                data-testid={`confirm-delete-${kind}-with-data-btn`}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Yes, Delete {labelKind} & All Data
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Initial Selection */
          <div>
            <h2 className="font-display text-xl text-ink">Delete {kind}?</h2>
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold text-ink">{name}</span> will be
              removed.
            </p>

            {isMultiOption ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-line bg-surface-muted/40 p-4 text-xs text-muted">
                  <div className="font-semibold text-ink text-[13px] flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary shrink-0" />
                    1. Delete {labelKind} Only
                  </div>
                  <p className="mt-1 pl-4 leading-relaxed text-ink-soft">
                    Removes the {kind} account while keeping all historical
                    bookings and financial records intact, marked as{" "}
                    <strong className="text-ink">"{name} (deleted)"</strong>.
                  </p>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-muted">
                  <div className="font-semibold text-red-600 text-[13px] flex items-center gap-2">
                    <span className="size-2 rounded-full bg-red-500 shrink-0" />
                    2. Delete {labelKind} with Data
                  </div>
                  <p className="mt-1 pl-4 leading-relaxed text-red-700/90">
                    Permanently deletes the {kind} along with all their assigned
                    bookings, payments, and related records.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Accounts with bookings or payments can't be deleted — suspend
                them instead, which blocks all access and keeps the records
                intact.
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={pending}>
                Cancel
              </Button>

              {isMultiOption ? (
                <div className="flex items-center gap-2.5">
                  {handleDeleteOnlyAction && (
                    <button
                      type="button"
                      onClick={() => setConfirmStep("only")}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-xs sm:text-sm font-medium border border-line bg-surface text-ink hover:bg-surface-muted hover:border-primary/40 hover:text-primary transition-all cursor-pointer disabled:opacity-50"
                      data-testid={`delete-${kind}-only-btn`}>
                      Delete {labelKind} Only
                    </button>
                  )}
                  {onDeleteWithData && (
                    <button
                      type="button"
                      onClick={() => setConfirmStep("with_data")}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-xs sm:text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      data-testid={`delete-${kind}-with-data-btn`}>
                      Delete {labelKind} with Data
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={pending}
                  className="inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2 text-xs sm:text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  data-testid="delete-btn">
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation for a non-destructive but consequential change — verifying a
 * cleaner, or suspending one. These used to fire on a single click, which is
 * uncomfortably easy next to each other in a toolbar: suspending ends the
 * cleaner's live sessions and drops them out of dispatch immediately.
 */
export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
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
        <h2 className="font-display text-xl text-ink">{title}</h2>
        <div className="mt-2 text-sm text-muted">{description}</div>

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
            className={
              destructive
                ? "bg-red-500 text-white hover:bg-red-600 focus-visible:outline-red-500"
                : undefined
            }>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
