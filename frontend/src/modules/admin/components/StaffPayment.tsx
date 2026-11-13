import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import type { AdminBookingDetail } from "../types";
export function StaffPayment({ booking }: { booking: AdminBookingDetail }) {
  const cache = useQueryClient();
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const collect = useMutation({ mutationFn: () => apiFetch(`/admin/bookings/${booking.id}/collect`, { method: "POST", body: { method, reference } }), onSuccess: () => { void cache.invalidateQueries({ queryKey: ["admin"] }); } });
  if (booking.bookingSource !== "staff") return null;
  const payment = booking.staffPayment;
  return <div className="mt-3 rounded-xl border border-primary/30 p-4 space-y-3 text-sm">
    <p className="font-medium">Staff booking · Created by {booking.createdByName}</p>
    {payment?.status === "paid" ? <p className="text-emerald-700">{formatMoney(payment.amount)} received by {payment.collectedByName} via {payment.collectionMethod?.toUpperCase()} on {payment.collectedAt ? new Date(payment.collectedAt).toLocaleString("en-IN") : "—"}{payment.collectionReference ? ` · Ref: ${payment.collectionReference}` : ""}</p> : payment?.status === "refunded" ? <p>Payment refunded.</p> : booking.status === "cancelled" ? <p>Booking cancelled. Collection is closed.</p> : payment ? <>
      <p>Payment due: <strong>{formatMoney(payment.amount)}</strong>. The customer can pay the admin or employee handling this booking. The employee receiving payment should record it here.</p>
      <label className="block">Payment method<select aria-label="Collection method" className="mt-1 block h-10 w-full rounded-xl border border-line bg-surface px-3" value={method} onChange={e => { setMethod(e.target.value); setConfirmed(false); }}><option value="cash">Cash</option><option value="upi">UPI</option></select></label>
      <label className="block">{method === "upi" ? "UPI transaction reference (required)" : "Receipt / note (optional)"}<input className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3" value={reference} maxLength={120} onChange={e => setReference(e.target.value)} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have received the full {formatMoney(payment.amount)} from the customer.</label>
      <Button size="sm" disabled={!confirmed || collect.isPending || (method === "upi" && !reference.trim())} onClick={() => collect.mutate()}>{collect.isPending ? "Recording…" : "Record payment received"}</Button>
      {collect.error && <p role="alert" className="text-red-600">{collect.error.message}</p>}
    </> : <p>Payment record unavailable. Refresh before collecting.</p>}
  </div>;
}
