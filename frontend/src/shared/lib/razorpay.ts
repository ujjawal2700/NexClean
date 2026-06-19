/** Razorpay Checkout loader + a thin open() helper. */

export type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type CheckoutOptions = {
  key: string;
  amount: number; // paise
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayCtor = new (options: CheckoutOptions) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Inject the Checkout script once; resolves true when available. */
export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function openRazorpay(options: CheckoutOptions): void {
  if (!window.Razorpay) throw new Error("Razorpay not loaded");
  new window.Razorpay(options).open();
}
