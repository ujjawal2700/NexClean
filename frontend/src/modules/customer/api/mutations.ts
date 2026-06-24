import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { meKey, bookingsKey, notificationsKey } from "./queries";
import type { User, Booking, CarType } from "../types";

/* ---------------------------- Notifications ------------------------------ */

export function useRegisterToken() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ registered: boolean }>("/notifications/register-token", {
        method: "POST",
        body: { token },
      }),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/notifications/read", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

/* ------------------------------- Auth ----------------------------------- */

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ sent: boolean }>("/auth/send-otp", { method: "POST", body: { phone } }),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (vars: { phone: string; code: string }) =>
      apiFetch<{ token: string; user: User }>("/auth/verify-otp", {
        method: "POST",
        body: vars,
      }),
  });
}

export function useCustomerSignup() {
  return useMutation({
    mutationFn: (vars: { name: string; phone: string; email?: string; referralCode?: string }) =>
      apiFetch<{ sent: boolean }>("/auth/customer/signup", { method: "POST", body: vars }),
  });
}

/* ------------------------- Profile (updates `me`) ------------------------ */

function useUserMutation<TVars>(fn: (vars: TVars) => Promise<User>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useUpdateProfile() {
  return useUserMutation((updates: { name?: string; email?: string }) =>
    apiFetch<User>("/users/me", { method: "PATCH", body: updates }),
  );
}

/** Step 1 of a phone-number change: sends an OTP to the new number. */
export function useRequestPhoneChange() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ sent: boolean }>("/users/me/phone/request-otp", { method: "POST", body: { phone } }),
  });
}

/** Step 2: verifies the OTP and commits the new phone number as the login identifier. */
export function useConfirmPhoneChange() {
  return useUserMutation((vars: { phone: string; code: string }) =>
    apiFetch<User>("/users/me/phone/confirm", { method: "POST", body: vars }),
  );
}

export function useAddVehicle() {
  return useUserMutation((v: { type: CarType; name: string; plate?: string }) =>
    apiFetch<User>("/users/me/vehicles", { method: "POST", body: v }),
  );
}

export function useRemoveVehicle() {
  return useUserMutation((id: string) =>
    apiFetch<User>(`/users/me/vehicles/${id}`, { method: "DELETE" }),
  );
}

export function useAddAddress() {
  return useUserMutation((a: { label: string; line: string; society?: string }) =>
    apiFetch<User>("/users/me/addresses", { method: "POST", body: a }),
  );
}

export function useRemoveAddress() {
  return useUserMutation((id: string) =>
    apiFetch<User>(`/users/me/addresses/${id}`, { method: "DELETE" }),
  );
}

export function useSubscribe() {
  return useUserMutation((planId: string) =>
    apiFetch<User>("/subscriptions", { method: "POST", body: { planId } }),
  );
}

export function useUnsubscribe() {
  return useUserMutation<void>(() => apiFetch<User>("/subscriptions", { method: "DELETE" }));
}

/* ------------------------------ Bookings --------------------------------- */

export type CreateBookingInput = {
  vehicleType: CarType;
  vehicleName: string;
  packageId: string;
  date: string;
  slot: string;
  addressLabel: string;
  addressLine: string;
  discountCode?: string;
};

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiFetch<Booking>("/bookings", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingsKey }),
  });
}

/* ------------------------------ Payments --------------------------------- */

export type OrderResponse = {
  orderId: string;
  amount: number; // rupees
  currency: string;
  keyId: string;
  mock: boolean;
};

export function useCreateOrder() {
  return useMutation({
    mutationFn: (booking: CreateBookingInput) =>
      apiFetch<OrderResponse>("/payments/order", { method: "POST", body: { booking } }),
  });
}

export type PreviewAmountResponse = {
  basePrice: number;
  price: number;
  discountAmount: number;
  discountCode: string | null;
};

/** Validate a discount code and preview the discounted total before paying. */
export function usePreviewDiscount() {
  return useMutation({
    mutationFn: (vars: { vehicleType: CarType; packageId: string; discountCode?: string }) =>
      apiFetch<PreviewAmountResponse>("/payments/preview", { method: "POST", body: vars }),
  });
}

export type VerifyPaymentInput = {
  booking: CreateBookingInput;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyPaymentInput) =>
      apiFetch<Booking>("/payments/verify", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingsKey }),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Booking>(`/bookings/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookingsKey }),
  });
}
