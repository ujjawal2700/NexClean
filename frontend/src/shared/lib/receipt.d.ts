type ReceiptBooking = {
    id: string;
    customerName: string;
    vehicleName: string;
    packageName: string;
    date: string;
    slot: string;
    society: string;
    price: number;
    status: string;
    agentName: string | null;
};
type ReceiptPayment = {
    orderId: string;
    paymentId: string | null;
    status: string;
    amount: number;
    createdAt: string;
    customerName: string;
    bookingId: string | null;
    society: string;
    agentName: string | null;
} | null;
/** Builds a single-page PDF receipt for a booking and triggers a browser download. */
export declare function downloadBookingReceipt(booking: ReceiptBooking, payment: ReceiptPayment, categoryLabel: string): Promise<void>;
/** Builds a single-page PDF receipt for a payment record and triggers a browser download. */
export declare function downloadPaymentReceipt(payment: NonNullable<ReceiptPayment>, booking: ReceiptBooking | null, categoryLabel: string): Promise<void>;
export {};
