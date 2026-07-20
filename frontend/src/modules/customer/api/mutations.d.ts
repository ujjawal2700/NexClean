import type { RazorpayResponse } from "@shared/lib/razorpay";
import type { User, Booking, CarType, SupportTicket, ChatMessage, SupportConfig } from "../types";
export declare function useRegisterToken(): import("@tanstack/react-query").UseMutationResult<{
    registered: boolean;
}, Error, string, unknown>;
export declare function useMarkNotificationsRead(): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
}, Error, void, unknown>;
export declare function useDeactivateAccount(): import("@tanstack/react-query").UseMutationResult<{
    deactivated: boolean;
}, Error, void, unknown>;
export declare function useSendOtp(): import("@tanstack/react-query").UseMutationResult<{
    sent: boolean;
}, Error, string, unknown>;
export declare function useVerifyOtp(): import("@tanstack/react-query").UseMutationResult<{
    token: string;
    user: User;
}, Error, {
    phone: string;
    code: string;
}, unknown>;
export declare function useCustomerSignup(): import("@tanstack/react-query").UseMutationResult<{
    sent: boolean;
}, Error, {
    name: string;
    phone: string;
    email?: string;
    referralCode?: string;
}, unknown>;
export declare function useUpdateProfile(): import("@tanstack/react-query").UseMutationResult<User, Error, {
    name?: string;
    email?: string;
}, unknown>;
/** Step 1 of a phone-number change: sends an OTP to the new number. */
export declare function useRequestPhoneChange(): import("@tanstack/react-query").UseMutationResult<{
    sent: boolean;
}, Error, string, unknown>;
/** Step 2: verifies the OTP and commits the new phone number as the login identifier. */
export declare function useConfirmPhoneChange(): import("@tanstack/react-query").UseMutationResult<User, Error, {
    phone: string;
    code: string;
}, unknown>;
export declare function useAddVehicle(): import("@tanstack/react-query").UseMutationResult<User, Error, {
    type: CarType;
    name: string;
    brand?: string;
    model?: string;
    plate?: string;
}, unknown>;
export declare function useRemoveVehicle(): import("@tanstack/react-query").UseMutationResult<User, Error, string, unknown>;
export declare function useAddAddress(): import("@tanstack/react-query").UseMutationResult<User, Error, {
    label: string;
    line: string;
    society?: string;
    lat?: number;
    lng?: number;
    placeId?: string;
}, unknown>;
export declare function useRemoveAddress(): import("@tanstack/react-query").UseMutationResult<User, Error, string, unknown>;
export type SubscriptionCheckoutVars = {
    planId: string;
    vehicleType?: string;
    coinsToRedeem?: number;
};
/** Create a Razorpay order (or mock) for a subscription purchase. */
export declare function useCreateSubscriptionOrder(): import("@tanstack/react-query").UseMutationResult<OrderResponse, Error, SubscriptionCheckoutVars, unknown>;
/** Verify the Razorpay payment (or mock) and activate the subscription. */
export declare function useVerifySubscription(): import("@tanstack/react-query").UseMutationResult<User, Error, SubscriptionCheckoutVars & Partial<RazorpayResponse>, unknown>;
export type SubscriptionPreview = {
    basePrice: number;
    price: number;
    coinsRedeemed: number;
    coinDiscount: number;
    coinsPerRupee: number;
};
/** Preview a subscription's price with coins applied, before committing. */
export declare function usePreviewSubscription(): import("@tanstack/react-query").UseMutationResult<SubscriptionPreview, Error, SubscriptionCheckoutVars, unknown>;
export declare function useUnsubscribe(): import("@tanstack/react-query").UseMutationResult<User, Error, void, unknown>;
export type CreateBookingInput = {
    vehicleType: CarType;
    vehicleName: string;
    packageId: string;
    date: string;
    slot: string;
    addressLabel: string;
    addressLine: string;
    discountCode?: string;
    /** Coins the customer chose to redeem (server clamps to balance + admin cap). */
    coinsToRedeem?: number;
    /** Service-location geo from the selected address (enables nearest-agent dispatch). */
    lat?: number;
    lng?: number;
};
export declare function useCreateBooking(): import("@tanstack/react-query").UseMutationResult<Booking, Error, CreateBookingInput, unknown>;
export type OrderResponse = {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    mock: boolean;
};
export declare function useCreateOrder(): import("@tanstack/react-query").UseMutationResult<OrderResponse, Error, CreateBookingInput, unknown>;
export type PreviewAmountResponse = {
    basePrice: number;
    price: number;
    discountAmount: number;
    discountCode: string | null;
    coinsRedeemed: number;
    coinDiscount: number;
};
/** Validate a discount code / coin redemption and preview the final total before paying. */
export declare function usePreviewDiscount(): import("@tanstack/react-query").UseMutationResult<PreviewAmountResponse, Error, {
    vehicleType: CarType;
    packageId: string;
    discountCode?: string;
    coinsToRedeem?: number;
}, unknown>;
export type VerifyPaymentInput = {
    booking: CreateBookingInput;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
};
export declare function useVerifyPayment(): import("@tanstack/react-query").UseMutationResult<Booking, Error, VerifyPaymentInput, unknown>;
export declare function useCancelBooking(): import("@tanstack/react-query").UseMutationResult<Booking, Error, string, unknown>;
export declare function useScheduleSubscriptionWash(): import("@tanstack/react-query").UseMutationResult<Booking, Error, {
    vehicleId: string;
    addressId: string;
    date: string;
    slot: string;
}, unknown>;
export declare function useRescheduleSubscriptionWash(): import("@tanstack/react-query").UseMutationResult<Booking, Error, {
    bookingId: string;
    date: string;
    slot: string;
}, unknown>;
export declare function useCreateTicket(): import("@tanstack/react-query").UseMutationResult<SupportTicket, Error, {
    subject?: string;
}, unknown>;
export declare function useCloseTicket(): import("@tanstack/react-query").UseMutationResult<SupportTicket, Error, string, unknown>;
export declare function useReopenTicket(): import("@tanstack/react-query").UseMutationResult<SupportTicket, Error, string, unknown>;
export declare function useSendMessage(): import("@tanstack/react-query").UseMutationResult<ChatMessage, Error, {
    ticketId: string;
    text: string;
}, unknown>;
export declare function useUpdateSupportConfig(): import("@tanstack/react-query").UseMutationResult<SupportConfig, Error, "auto" | "offline" | "online", unknown>;
