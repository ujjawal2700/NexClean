import { StaticPageShell } from "../components/StaticPageShell";

export function Terms() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Terms of service"
      subtitle="Last updated June 2026. By booking through NexClean, you agree to the terms below."
    >
      <h2>Bookings</h2>
      <p>
        When you book a cleaning, you're requesting a specialist to attend the location and time
        you specify. Please ensure the vehicle is accessible and reasonably free of personal
        belongings at the scheduled time.
      </p>

      <h2>Subscriptions</h2>
      <p>
        Subscription plans renew automatically each billing cycle until cancelled. You can cancel
        anytime from your account; access continues until the end of the current billing period.
      </p>

      <h2>Specialists</h2>
      <p>
        Specialists on NexClean are independent professionals who complete our verification and KYC
        process before accepting jobs. NexClean facilitates the booking and payment but specialists
        are responsible for the quality of service delivered.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Provide accurate booking details — incorrect addresses or vehicle info may delay service.</li>
        <li>Treat specialists with respect; abusive behavior may result in account suspension.</li>
        <li>Don't use the platform for any unlawful purpose.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        NexClean takes reasonable care in vetting specialists, but is not liable for pre-existing
        vehicle damage. Any service-related damage should be reported within 24 hours so we can
        investigate with the specialist involved.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as the service evolves. Continued use of NexClean after an update
        means you accept the revised terms.
      </p>
    </StaticPageShell>
  );
}
