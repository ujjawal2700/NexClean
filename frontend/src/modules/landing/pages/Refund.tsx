import { Link } from "react-router-dom";
import { StaticPageShell } from "../components/StaticPageShell";

export function Refund() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Refund policy"
      subtitle="Last updated June 2026. We want every booking to feel risk-free."
    >
      <h2>One-off bookings</h2>
      <ul>
        <li>Cancel before a specialist is dispatched — full refund, no questions asked.</li>
        <li>Cancel after dispatch but before the specialist arrives — partial refund, minus a small dispatch fee.</li>
        <li>Not satisfied with the service — contact us within 24 hours and we'll arrange a re-clean or refund.</li>
      </ul>

      <h2>Subscriptions</h2>
      <p>
        Unused washes don't carry a per-wash refund, but you can cancel your subscription anytime
        and you'll keep access until the end of the current billing period — no further charges
        after that.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Approved refunds are returned to your original payment method and typically reflect within
        5–7 business days, depending on your bank.
      </p>

      <h2>Need a refund?</h2>
      <p>
        Reach out via our <Link to="/contact">Contact</Link> page with your booking details and
        we'll take it from there.
      </p>
    </StaticPageShell>
  );
}
