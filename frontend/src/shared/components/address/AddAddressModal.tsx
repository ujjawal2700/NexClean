import { useRef, useState } from "react";
import { X, MapPin, Search, Crosshair, Building2, Home, Briefcase, Tag, Check, Loader2, AlertCircle, LocateFixed, Sparkles } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ServicePinPicker } from "@shared/components/map/ServicePinPicker";
import { usePlacesAutocomplete } from "@shared/hooks/usePlacesAutocomplete";
import { type LatLng } from "@shared/lib/maps";
import {
  getCurrentPosition,
  reverseGeocode,
  LOCATE_MESSAGE,
  type LocateFailure,
  type StructuredAddress,
} from "@shared/lib/geocode";
import { useAddAddress, useUpdateAddress, useRequestArea } from "@modules/customer/api/mutations";
import { checkServiceCoverage } from "@modules/customer/api/public";
import type { Address } from "@modules/customer/types";

type Props = {
  onClose: () => void;
  onSuccess?: (newAddress: Address) => void;
  initialCoords?: LatLng | null;
  editingAddress?: Address | null;
};

const LABEL_PRESETS = [
  { id: "Home", label: "Home", icon: Home },
  { id: "Office", label: "Office", icon: Briefcase },
  { id: "Other", label: "Other", icon: Tag },
];

function parseInitialLine(line?: string, society?: string) {
  if (!line) return { hNo: "", bSoc: society || "", sLandmark: "", cty: "", pincodeVal: "" };
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  let pincodeVal = "";
  const filteredParts: string[] = [];
  for (const part of parts) {
    if (/^PIN:\s*\d{6}$/i.test(part) || /^\d{6}$/.test(part)) {
      pincodeVal = part.replace(/PIN:\s*/i, "").trim();
    } else {
      filteredParts.push(part);
    }
  }
  const hNo = filteredParts[0] || "";
  const bSoc = society || filteredParts[1] || "";
  const sLandmark = filteredParts.length > 3 ? filteredParts.slice(2, -1).join(", ") : (filteredParts[2] || "");
  const cty = filteredParts.length > 2 ? filteredParts[filteredParts.length - 1] : "";
  return { hNo, bSoc, sLandmark, cty, pincodeVal };
}

export function AddAddressModal({ onClose, onSuccess, initialCoords, editingAddress }: Props) {
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();
  const requestArea = useRequestArea();
  const isEditing = Boolean(editingAddress);

  const initialParsed = parseInitialLine(editingAddress?.line, editingAddress?.society);

  const editCoords: LatLng | null =
    editingAddress?.coordinates && editingAddress.coordinates.length === 2
      ? { lat: editingAddress.coordinates[1], lng: editingAddress.coordinates[0] }
      : null;

  // Pin & Geo State
  const [pinCoords, setPinCoords] = useState<LatLng | null>(initialCoords ?? editCoords ?? null);
  const [mapFallbackCenter, setMapFallbackCenter] = useState<LatLng | null>(initialCoords ?? editCoords ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeId, setPlaceId] = useState(editingAddress?.placeId || "");

  // Structured Address Fields
  const [houseNo, setHouseNo] = useState(initialParsed.hNo);
  const [buildingSociety, setBuildingSociety] = useState(initialParsed.bSoc);
  const [streetLandmark, setStreetLandmark] = useState(initialParsed.sLandmark);
  const [city, setCity] = useState(initialParsed.cty);
  const [pincode, setPincode] = useState(initialParsed.pincodeVal);

  // Label State
  const initialPreset: "Home" | "Office" | "Other" =
    editingAddress?.label === "Home" || editingAddress?.label === "Office"
      ? editingAddress.label
      : editingAddress?.label
        ? "Other"
        : "Home";

  const [selectedPreset, setSelectedPreset] = useState<"Home" | "Office" | "Other">(initialPreset);
  const [customLabel, setCustomLabel] = useState(
    editingAddress?.label && !["Home", "Office"].includes(editingAddress.label) ? editingAddress.label : "",
  );

  const [formError, setFormError] = useState("");

  // "Fetch my location" state, kept apart from formError so a geolocation
  // problem doesn't look like a validation problem.
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  // Geofence coverage — checked at submit time, not blocked by formError so
  // it can show its own "request this area" action instead of a plain error.
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [outsideServiceArea, setOutsideServiceArea] = useState(false);
  const [areaRequested, setAreaRequested] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete for quick location searching on the map
  usePlacesAutocomplete({
    inputRef: searchInputRef,
    types: ["geocode", "establishment"],
    onSelect: (placeName, pId, coords) => {
      setSearchQuery(placeName);
      setPlaceId(pId);
      if (coords) {
        setPinCoords(coords);
        setMapFallbackCenter(coords);
        setOutsideServiceArea(false);
        setAreaRequested(false);
        void reverseGeocode(coords).then((addr) => {
          if (addr) applyAddress(addr, false);
        });
      }
      if (!buildingSociety) {
        setBuildingSociety(placeName);
      }
    },
  });

  /**
   * Write a reverse-geocoded address into the form.
   *
   * `overwrite` is the difference between the two ways this runs. Pressing
   * "Use my current location" is an explicit request to fill the form, so it
   * replaces what is there. Nudging the map is not — it happens constantly
   * while someone positions the pin, and clobbering a flat number they already
   * typed because they dragged 20 metres would be maddening.
   */
  const applyAddress = (addr: StructuredAddress, overwrite: boolean) => {
    const put = (current: string, next: string, setter: (v: string) => void) => {
      if (!next) return;
      if (overwrite || !current.trim()) setter(next);
    };
    put(houseNo, addr.houseNo, setHouseNo);
    put(buildingSociety, addr.society || addr.street, setBuildingSociety);
    put(streetLandmark, addr.street, setStreetLandmark);
    put(city, addr.city, setCity);
    put(pincode, addr.pincode, setPincode);
  };

  // Dragging the pin refines the address, but never overwrites typed input.
  const handlePinChange = (coords: LatLng, formattedAddress?: string) => {
    setPinCoords(coords);
    // A moved pin needs a fresh coverage check, not the last one's verdict.
    setOutsideServiceArea(false);
    setAreaRequested(false);
    if (!formattedAddress) return;
    void reverseGeocode(coords).then((addr) => {
      if (addr) applyAddress(addr, false);
    });
  };

  /**
   * One button that does the whole job: locate the device, move the pin there,
   * and fill every address field from it.
   *
   * The pin is set from the GPS fix before geocoding is attempted, so a
   * rejected Maps key or a failed lookup still leaves the customer with an
   * accurate location — they just type the address themselves instead of
   * losing both.
   */
  const useCurrentLocation = async () => {
    setLocating(true);
    setLocateError("");
    setOutsideServiceArea(false);
    setAreaRequested(false);
    setAutoFilled(false);
    try {
      const { coords, accuracy } = await getCurrentPosition();
      setPinCoords(coords);
      setMapFallbackCenter(coords);

      const addr = await reverseGeocode(coords);
      if (addr) {
        applyAddress(addr, true);
        setSearchQuery(addr.formatted);
        setAutoFilled(true);
      } else {
        setLocateError(
          "Pin set from your GPS, but the address lookup is unavailable — please fill the fields below.",
        );
      }

      // A fix this coarse is a tower triangulation, not GPS. Saying so is
      // better than silently pinning the wrong end of the street.
      if (accuracy > 100) {
        setLocateError(
          `Your location is only accurate to about ${Math.round(accuracy)}m — drag the map to fine-tune the pin.`,
        );
      }
    } catch (err) {
      setLocateError(LOCATE_MESSAGE[err as LocateFailure] ?? LOCATE_MESSAGE.unavailable);
    } finally {
      setLocating(false);
    }
  };

  const effectiveLabel = selectedPreset === "Other" ? (customLabel.trim() || "Other") : selectedPreset;

  const handleRequestArea = () => {
    if (!pinCoords) return;
    requestArea.mutate(
      { lat: pinCoords.lat, lng: pinCoords.lng, label: buildingSociety.trim() || searchQuery.trim() || undefined },
      { onSuccess: () => setAreaRequested(true) },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setOutsideServiceArea(false);

    if (!houseNo.trim()) {
      setFormError("Please enter Flat / House / Block number.");
      return;
    }
    if (!buildingSociety.trim()) {
      setFormError("Please enter Society / Apartment / Building name.");
      return;
    }
    if (!effectiveLabel) {
      setFormError("Please select or enter an address label.");
      return;
    }

    // Geofence check — separate from formError so it can offer its own
    // "request this area" action instead of a plain red banner. Zero zones
    // configured (a fresh deployment, or one not using geofencing yet) means
    // "serviceable" by default rather than rejecting every address.
    if (pinCoords) {
      setCheckingCoverage(true);
      try {
        const coverage = await checkServiceCoverage(pinCoords.lat, pinCoords.lng);
        if (coverage.zonesConfigured && !coverage.serviceable) {
          setCheckingCoverage(false);
          setOutsideServiceArea(true);
          return;
        }
      } catch {
        // Fail open: a transient check failure shouldn't block saving a
        // real address, only a confirmed "outside every zone" should.
      }
      setCheckingCoverage(false);
    }

    // Build the complete, clean structured address line
    const addressParts = [
      houseNo.trim(),
      buildingSociety.trim(),
      streetLandmark.trim(),
      city.trim(),
      pincode.trim() ? `PIN: ${pincode.trim()}` : "",
    ].filter(Boolean);

    const fullLine = addressParts.join(", ");

    const payload = {
      label: effectiveLabel,
      line: fullLine,
      society: buildingSociety.trim(),
      lat: pinCoords?.lat,
      lng: pinCoords?.lng,
      placeId: placeId || undefined,
    };

    if (isEditing && editingAddress) {
      updateAddress.mutate(
        { id: editingAddress.id, data: payload },
        {
          onSuccess: (user) => {
            const updated = user.addresses?.find((a) => a.id === editingAddress.id);
            if (updated && onSuccess) {
              onSuccess(updated);
            }
            onClose();
          },
          onError: (err: any) => {
            setFormError(err?.message || "Failed to update address. Please check your details.");
          },
        },
      );
    } else {
      addAddress.mutate(
        payload,
        {
          onSuccess: (user) => {
            const created = user.addresses?.[user.addresses.length - 1];
            if (created && onSuccess) {
              onSuccess(created);
            }
            onClose();
          },
          onError: (err: any) => {
            setFormError(err?.message || "Failed to save address. Please check your details.");
          },
        },
      );
    }
  };

  const isPending = addAddress.isPending || updateAddress.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-address-modal-title"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <div>
              <h2 id="add-address-modal-title" className="font-display text-lg font-semibold text-ink">
                {isEditing ? "Edit Service Address" : "Add Service Address"}
              </h2>
              <p className="text-xs text-muted">
                {isEditing
                  ? "Update your vehicle spot on the map and address details"
                  : "Pin your vehicle spot on the map and complete address details"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-ink cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content & Form */}
        <form id="add-address-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Map Pinning Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Crosshair className="size-4 text-primary" />
                <span className="font-display text-sm font-semibold text-ink">Pin Location on Map</span>
              </div>
              {pinCoords ? (
                <span
                  className="rounded-pill bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600"
                  data-testid="address-pinned-coords"
                >
                  📍 {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
                </span>
              ) : (
                <span className="rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                  Move map to set exact spot
                </span>
              )}
            </div>

            {/* The one-tap path. Placed above the search because it is what most
                people want: they are standing at the address they are adding. */}
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              data-testid="use-current-location"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-left transition-all cursor-pointer",
                "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {locating ? "Finding your location…" : "Use my current location"}
                </span>
                <span className="block text-xs text-muted">
                  {locating
                    ? "Allow location access if your browser asks"
                    : "Fills the address below automatically"}
                </span>
              </span>
            </button>

            {autoFilled && !locateError && (
              <p
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-700"
                data-testid="autofill-success"
              >
                <Sparkles className="size-3.5 shrink-0" />
                Address filled from your location — check the details and edit anything that's off.
              </p>
            )}

            {locateError && (
              <p
                className="flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700"
                data-testid="locate-error"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                {locateError}
              </p>
            )}

            {/* Places search input to center map */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="…or search a society, building or area"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-muted/50 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                data-testid="address-map-search"
              />
            </div>

            {/* Map Canvas with center-pin picker */}
            <div className="overflow-hidden rounded-2xl border border-line">
              <ServicePinPicker
                value={pinCoords}
                fallbackCenter={mapFallbackCenter}
                onChange={handlePinChange}
                className="h-56 sm:h-64"
              />
            </div>
            <p className="text-[11px] text-muted text-center">
              💡 Drag the map so the pin sits directly where your vehicle is parked. Your cleaner navigates to this pin.
            </p>
          </div>

          {/* 2. Structured Address Details */}
          <div className="space-y-4 pt-2 border-t border-line">
            <div className="flex items-center gap-1.5">
              <Building2 className="size-4 text-primary" />
              <span className="font-display text-sm font-semibold text-ink">Address Details</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                name="houseNo"
                label="Flat / House / Block / Floor No. *"
                placeholder="e.g. Flat 402, Tower B"
                value={houseNo}
                onChange={(e) => setHouseNo(e.target.value)}
                required
                data-testid="input-house-no"
              />
              <Input
                name="buildingSociety"
                label="Society / Building / Apartment Name *"
                placeholder="e.g. Green Valley Heights, Sector 45"
                value={buildingSociety}
                onChange={(e) => setBuildingSociety(e.target.value)}
                required
                data-testid="input-society"
              />
              <Input
                name="streetLandmark"
                label="Street / Landmark (Optional)"
                placeholder="e.g. Near Club House / Gate 2"
                value={streetLandmark}
                onChange={(e) => setStreetLandmark(e.target.value)}
                data-testid="input-landmark"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  name="city"
                  label="City"
                  placeholder="e.g. Gurugram"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  data-testid="input-city"
                />
                <Input
                  name="pincode"
                  label="Pincode"
                  placeholder="e.g. 122003"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  data-testid="input-pincode"
                />
              </div>
            </div>

            {/* 3. Address Label / Type Selection */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Save As / Label *
              </label>
              <div className="flex flex-wrap gap-2">
                {LABEL_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset.id as any)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-line bg-surface text-ink hover:border-primary/40",
                      )}
                      data-testid={`label-preset-${preset.id.toLowerCase()}`}
                    >
                      <Icon className="size-3.5" />
                      {preset.label}
                      {isSelected && <Check className="size-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>

              {selectedPreset === "Other" && (
                <div className="mt-3">
                  <Input
                    name="customLabel"
                    label="Custom Label Name"
                    placeholder="e.g. Parents' Villa, Club Parking, Studio"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    required={selectedPreset === "Other"}
                    data-testid="input-custom-label"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-600">
              <AlertCircle className="size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Outside every drawn geofence — offer to request coverage instead of a plain error */}
          {outsideServiceArea && (
            <div
              className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"
              data-testid="outside-service-area"
            >
              {!areaRequested ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-ink">We're not in your area yet</p>
                      <p className="mt-0.5 text-xs text-muted">
                        This pin falls outside every service zone we currently cover. Let us know you're
                        here and we'll reach out once we launch nearby.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRequestArea}
                    disabled={requestArea.isPending}
                    className="w-full"
                    data-testid="request-area-btn"
                  >
                    {requestArea.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Requesting...
                      </>
                    ) : (
                      "Request this area"
                    )}
                  </Button>
                </>
              ) : (
                <p
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                  data-testid="area-requested-confirmation"
                >
                  <Check className="size-3.5 shrink-0" />
                  Thanks — we've noted your area and will reach out once we're live nearby. You can close
                  this or pin a different address.
                </p>
              )}
            </div>
          )}

        </form>

        {/* Fixed Footer Actions */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-line bg-surface px-6 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-address-form"
            size="sm"
            disabled={isPending || checkingCoverage || !houseNo.trim() || !buildingSociety.trim()}
            data-testid="save-address-btn"
          >
            {checkingCoverage ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Checking coverage...
              </>
            ) : isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {isEditing ? "Updating Address..." : "Saving Address..."}
              </>
            ) : (
              isEditing ? "Save Changes" : "Save Address"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
