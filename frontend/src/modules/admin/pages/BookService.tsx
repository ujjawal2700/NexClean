import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@shared/lib/api";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { GlassCard } from "@shared/ui/GlassCard";
import { formatMoney } from "@shared/lib/format";
import type { AddressInput } from "@shared/components/address/AddAddressModal";
import { useVehicleCategories, useCategoryLabel } from "../../customer/api/queries";
import type { Address, Vehicle } from "../../customer/types";
import { VehicleStep, PackageStep, ScheduleStep, AddressStep, EMPTY, type Draft } from "../../customer/pages/booking/BookingFlow";

type Customer = { id: string; name: string; phone: string; coins: number; vehicles: Vehicle[]; addresses: Address[] };
type Quote = { amount: number; taxAmount: number; basePrice: number; discountCode: string | null; discountAmount: number; coinsRedeemed: number; coinDiscount: number };

export function BookService() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [discountInput, setDiscountInput] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [useCoins, setUseCoins] = useState(false);
  const { data: categories = [] } = useVehicleCategories();
  const categoryLabel = useCategoryLabel();
  const set = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const customers = useQuery({
    queryKey: ["admin", "booking-customers", term],
    queryFn: () => apiFetch<Customer[]>(`/admin/booking-customers?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
  });
  const details = useQuery({
    queryKey: ["admin", "booking-customer", customerId],
    queryFn: () => apiFetch<Customer>(`/admin/booking-customers/${customerId}`),
    enabled: !!customerId,
    refetchOnWindowFocus: false,
  });
  const customer = details.data;
  useEffect(() => {
    const vehicle = customer?.vehicles[0];
    setDraft({
      ...EMPTY,
      vehicleType: vehicle?.type ?? null,
      vehicleName: vehicle?.name ?? "",
      vehiclePlate: vehicle?.plate === "—" ? "" : vehicle?.plate ?? "",
      vehicleColor: vehicle?.color ?? "",
      vehicleColorHex: vehicle?.colorHex ?? "",
      addressId: customer?.addresses[0]?.id ?? null,
    });
    setDiscountInput("");
    setDiscountCode("");
    setUseCoins(false);
    // Initialise once for each customer; saving an address must preserve the booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  const address = customer?.addresses.find(a => a.id === draft.addressId);
  const coordinates = draft.pin ?? (address?.coordinates?.length === 2
    ? { lng: address.coordinates[0], lat: address.coordinates[1] }
    : null);
  const payload = {
    customerId,
    vehicleType: draft.vehicleType,
    vehicleName: draft.vehicleName,
    vehiclePlate: draft.vehiclePlate,
    vehicleColor: draft.vehicleColor,
    ...(draft.vehicleColorHex ? { vehicleColorHex: draft.vehicleColorHex } : {}),
    packageId: draft.packageId,
    date: draft.date,
    slot: draft.slot,
    addressLabel: address?.label,
    addressLine: address?.line,
    ...(coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : {}),
    ...(discountCode ? { discountCode } : {}),
    ...(useCoins ? { coinsToRedeem: customer?.coins ?? 0 } : {}),
  };
  const ready = !!(customer && draft.vehicleType && draft.vehicleName.trim() && draft.packageId && draft.date && draft.slot && address);
  const quote = useQuery({
    queryKey: ["admin", "staff-booking-quote", payload],
    queryFn: () => apiFetch<Quote>("/admin/bookings/quote", { method: "POST", body: payload }),
    enabled: ready,
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => apiFetch<{ id: string }>("/admin/bookings", { method: "POST", body: payload }),
    onSuccess: (booking) => {
      void cache.invalidateQueries({ queryKey: ["admin"] });
      navigate(`/admin/bookings/${booking.id}`);
    },
  });
  const saveAddress = async (input: AddressInput) => {
    const saved = await apiFetch<Address>(`/admin/booking-customers/${customerId}/addresses`, { method: "POST", body: input });
    cache.setQueryData<Customer>(["admin", "booking-customer", customerId], current => current
      ? { ...current, addresses: [...current.addresses, saved] }
      : current);
    return saved;
  };

  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <div>
      <h1 className="font-display text-3xl text-ink">Book a service</h1>
      <p className="mt-1 text-muted">Create a booking on behalf of a customer, then record payment when received.</p>
    </div>
    <div role="form" aria-label="Book a service" className="space-y-6">
      <GlassCard className="space-y-3">
        <Input name="customerSearch" label="Find customer" placeholder="Search by name or phone number" value={search} onChange={e => setSearch(e.target.value)} />
        {customers.isFetching && <p>Searching…</p>}
        {customers.error && <p role="alert">{customers.error.message}</p>}
        {term.length >= 2 && customers.data?.length === 0 && <p>No active customers found.</p>}
        <div className="space-y-1">{customers.data?.map(c => <button type="button" key={c.id} className={`block w-full rounded-xl border p-3 text-left ${customerId === c.id ? "border-primary" : "border-line"}`} onClick={() => setCustomerId(c.id)}>{c.name} · {c.phone}</button>)}</div>
        {details.isFetching && <p>Loading customer…</p>}
        {details.error && <p role="alert">{details.error.message}</p>}
        {customer && <p className="text-sm text-primary">Booking for {customer.name} · {customer.phone}</p>}
      </GlassCard>
      {customer && <fieldset disabled={create.isPending} className="min-w-0 space-y-6">
        <GlassCard><VehicleStep key={customerId} draft={draft} set={set} vehicles={customer.vehicles} categoryLabel={categoryLabel} /></GlassCard>
        <GlassCard><PackageStep draft={draft} set={set} categories={categories} /></GlassCard>
        <GlassCard><ScheduleStep draft={draft} set={set} /></GlassCard>
        <GlassCard><AddressStep draft={draft} set={set} addresses={customer.addresses} onCreateAddress={saveAddress} /></GlassCard>
        <GlassCard className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Payment</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1"><Input name="discountCode" label="Discount code" placeholder="Enter code" value={discountInput} onChange={e => setDiscountInput(e.target.value.toUpperCase())} /></div>
            <Button type="button" variant="outline" disabled={!discountInput.trim()} onClick={() => setDiscountCode(discountInput.trim())}>Apply</Button>
            {discountCode && <Button type="button" variant="ghost" onClick={() => { setDiscountCode(""); setDiscountInput(""); }}>Remove code</Button>}
          </div>
          {(customer.coins ?? 0) > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} />Use customer's {customer.coins.toLocaleString("en-IN")} coins</label>}
          {ready && quote.data && !quote.error && <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Service price</dt><dd>{formatMoney(quote.data.basePrice)}</dd></div>
            {quote.data.discountCode && <div className="flex justify-between"><dt>{quote.data.discountCode} discount</dt><dd>−{formatMoney(quote.data.discountAmount)}</dd></div>}
            {quote.data.coinsRedeemed > 0 && <div className="flex justify-between"><dt>{quote.data.coinsRedeemed} coins redeemed</dt><dd>−{formatMoney(quote.data.coinDiscount)}</dd></div>}
            <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(quote.data.taxAmount)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total due</dt><dd>{formatMoney(quote.data.amount)}</dd></div>
          </dl>}
          {quote.isFetching ? <p>Calculating total…</p> : !ready && <p className="text-sm text-muted">Select vehicle, package, date, time and address to see the total.</p>}
          <p className="rounded-xl bg-primary/10 p-4 text-sm">Payment stays due. After creating the booking, record cash or UPI received by you or another employee in the booking's Payment section.</p>
        </GlassCard>
      </fieldset>}
      {(quote.error || create.error) && <p role="alert" className="text-red-600">{(create.error ?? quote.error)?.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => navigate("/admin/bookings")}>Cancel</Button>
        <Button type="button" onClick={() => create.mutate()} disabled={!ready || !quote.data || quote.isFetching || !!quote.error || create.isPending}>{create.isPending ? "Creating…" : "Create booking"}</Button>
      </div>
    </div>
  </div>;
}
