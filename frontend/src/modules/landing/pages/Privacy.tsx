import { StaticPageShell } from "../components/StaticPageShell";

export function Privacy() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Privacy policy"
      subtitle="Last updated June 2026. This page explains what we collect, why, and how you can control it."
    >
      <h2>What we collect</h2>
      <p>
        To book and deliver a cleaning service, we collect your name, phone number, email,
        addresses you book at, vehicle details, and payment information processed through our
        payment partner. Specialists submit identity and KYC documents during sign-up so customers
        can trust who's arriving at their door.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To schedule, assign, and track bookings between you and a specialist.</li>
        <li>To send booking confirmations, status updates, and NexClean Nearby offers.</li>
        <li>To verify specialist identity and eligibility to operate on the platform.</li>
        <li>To improve service quality, pricing, and coverage in your area.</li>
      </ul>

      <h2>What we don't do</h2>
      <p>
        We don't sell your personal data to third parties. Location data is only used to match you
        with nearby specialists and is not shared beyond what's needed to fulfill a booking.
      </p>

      <h2>Your controls</h2>
      <p>
        You can update or delete your account information from your profile at any time, or contact
        us to request a copy or deletion of your data.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Reach us at{" "}
        <a href="mailto:privacy@nexclean.in">privacy@nexclean.in</a>.
      </p>
    </StaticPageShell>
  );
}
