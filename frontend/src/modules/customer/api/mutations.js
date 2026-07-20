import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { meKey, bookingsKey, notificationsKey, walletKey, referralsKey } from "./queries";
/* ---------------------------- Notifications ------------------------------ */
export function useRegisterToken() {
    return useMutation({
        mutationFn: (token) => apiFetch("/notifications/register-token", {
            method: "POST",
            body: { token },
        }),
    });
}
export function useMarkNotificationsRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiFetch("/notifications/read", { method: "PATCH" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
    });
}
/* ------------------------------- Auth ----------------------------------- */
export function useDeactivateAccount() {
    return useMutation({
        mutationFn: () => apiFetch("/users/me/deactivate", { method: "POST" }),
    });
}
export function useSendOtp() {
    return useMutation({
        mutationFn: (phone) => apiFetch("/auth/send-otp", { method: "POST", body: { phone } }),
    });
}
export function useVerifyOtp() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/auth/verify-otp", {
            method: "POST",
            body: vars,
        }),
    });
}
export function useCustomerSignup() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/auth/customer/signup", { method: "POST", body: vars }),
    });
}
/* ------------------------- Profile (updates `me`) ------------------------ */
function useUserMutation(fn) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: (user) => qc.setQueryData(meKey, user),
    });
}
export function useUpdateProfile() {
    return useUserMutation((updates) => apiFetch("/users/me", { method: "PATCH", body: updates }));
}
/** Step 1 of a phone-number change: sends an OTP to the new number. */
export function useRequestPhoneChange() {
    return useMutation({
        mutationFn: (phone) => apiFetch("/users/me/phone/request-otp", { method: "POST", body: { phone } }),
    });
}
/** Step 2: verifies the OTP and commits the new phone number as the login identifier. */
export function useConfirmPhoneChange() {
    return useUserMutation((vars) => apiFetch("/users/me/phone/confirm", { method: "POST", body: vars }));
}
export function useAddVehicle() {
    return useUserMutation((v) => apiFetch("/users/me/vehicles", { method: "POST", body: v }));
}
export function useRemoveVehicle() {
    return useUserMutation((id) => apiFetch(`/users/me/vehicles/${id}`, { method: "DELETE" }));
}
export function useAddAddress() {
    return useUserMutation((a) => apiFetch("/users/me/addresses", { method: "POST", body: a }));
}
export function useRemoveAddress() {
    return useUserMutation((id) => apiFetch(`/users/me/addresses/${id}`, { method: "DELETE" }));
}
/** Create a Razorpay order (or mock) for a subscription purchase. */
export function useCreateSubscriptionOrder() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/subscriptions/order", { method: "POST", body: vars }),
    });
}
/** Verify the Razorpay payment (or mock) and activate the subscription. */
export function useVerifySubscription() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/subscriptions/verify", { method: "POST", body: vars }),
        onSuccess: (user) => {
            qc.setQueryData(meKey, user);
            qc.invalidateQueries({ queryKey: walletKey });
            qc.invalidateQueries({ queryKey: referralsKey });
        },
    });
}
/** Preview a subscription's price with coins applied, before committing. */
export function usePreviewSubscription() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/subscriptions/preview", { method: "POST", body: vars }),
    });
}
export function useUnsubscribe() {
    return useUserMutation(() => apiFetch("/subscriptions", { method: "DELETE" }));
}
export function useCreateBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch("/bookings", { method: "POST", body: input }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: walletKey });
            qc.invalidateQueries({ queryKey: referralsKey });
        },
    });
}
export function useCreateOrder() {
    return useMutation({
        mutationFn: (booking) => apiFetch("/payments/order", { method: "POST", body: { booking } }),
    });
}
/** Validate a discount code / coin redemption and preview the final total before paying. */
export function usePreviewDiscount() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/payments/preview", { method: "POST", body: vars }),
    });
}
export function useVerifyPayment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch("/payments/verify", { method: "POST", body: input }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: walletKey });
            qc.invalidateQueries({ queryKey: referralsKey });
        },
    });
}
export function useCancelBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/bookings/${id}/cancel`, { method: "PATCH" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: ["subscription", "schedule"] });
        },
    });
}
export function useScheduleSubscriptionWash() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/subscriptions/schedule", { method: "POST", body: vars }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: ["subscription", "schedule"] });
        },
    });
}
export function useRescheduleSubscriptionWash() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/subscriptions/schedule/${vars.bookingId}`, {
            method: "PATCH",
            body: { date: vars.date, slot: vars.slot },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: ["subscription", "schedule"] });
        },
    });
}
export function useCreateTicket() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/chat/tickets", { method: "POST", body: vars }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["chat", "tickets"] });
        },
    });
}
export function useCloseTicket() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ticketId) => apiFetch(`/chat/tickets/${ticketId}/close`, { method: "PATCH" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["chat", "tickets"] });
        },
    });
}
export function useReopenTicket() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ticketId) => apiFetch(`/chat/tickets/${ticketId}/reopen`, { method: "PATCH" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["chat", "tickets"] });
        },
    });
}
export function useSendMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/chat/tickets/${vars.ticketId}/messages`, {
            method: "POST",
            body: { text: vars.text },
        }),
        onSuccess: (_, vars) => {
            qc.invalidateQueries({ queryKey: ["chat", "tickets", vars.ticketId, "messages"] });
            // Invalidate tickets list to update the last message snippet
            qc.invalidateQueries({ queryKey: ["chat", "tickets"] });
        },
    });
}
export function useUpdateSupportConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (manualSupportStatus) => apiFetch("/chat/config", {
            method: "PATCH",
            body: { manualSupportStatus },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["chat", "config"] });
        },
    });
}
