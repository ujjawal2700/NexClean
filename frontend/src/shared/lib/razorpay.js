/** Razorpay Checkout loader + a thin open() helper. */
const SRC = "https://checkout.razorpay.com/v1/checkout.js";
/** Inject the Checkout script once; resolves true when available. */
export function loadRazorpay() {
    if (window.Razorpay)
        return Promise.resolve(true);
    return new Promise((resolve) => {
        const existing = document.querySelector(`script[src="${SRC}"]`);
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
export function openRazorpay(options) {
    if (!window.Razorpay)
        throw new Error("Razorpay not loaded");
    new window.Razorpay(options).open();
}
