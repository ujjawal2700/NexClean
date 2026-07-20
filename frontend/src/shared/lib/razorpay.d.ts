/** Razorpay Checkout loader + a thin open() helper. */
export type RazorpayResponse = {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
};
export type CheckoutOptions = {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    prefill?: {
        name?: string;
        contact?: string;
        email?: string;
    };
    theme?: {
        color?: string;
    };
    handler: (response: RazorpayResponse) => void;
    modal?: {
        ondismiss?: () => void;
    };
};
type RazorpayCtor = new (options: CheckoutOptions) => {
    open: () => void;
};
declare global {
    interface Window {
        Razorpay?: RazorpayCtor;
    }
}
/** Inject the Checkout script once; resolves true when available. */
export declare function loadRazorpay(): Promise<boolean>;
export declare function openRazorpay(options: CheckoutOptions): void;
export {};
