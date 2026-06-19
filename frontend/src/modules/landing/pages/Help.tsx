import { ChevronDown } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";

const FAQS = [
  {
    q: "How do I book a cleaning?",
    a: "Sign in or create an account, then choose Book cleaning. Pick your vehicle type, package, time, and location — a specialist is assigned and you'll see live status updates.",
  },
  {
    q: "What's included in a standard wash?",
    a: "Every package includes an exterior wash and interior clean at minimum. Premium and Elite plans add detailing, dedicated support, and priority scheduling — see the Subscription plans section for the full breakdown.",
  },
  {
    q: "Can I reschedule or cancel a booking?",
    a: "Yes — open the booking from your dashboard and choose reschedule or cancel. Basic and above plans include free rescheduling.",
  },
  {
    q: "What is NexClean Nearby?",
    a: "When a specialist is already working in your area, nearby customers get a personalized offer to get their vehicle cleaned too, often with priority service if booked within the offer window.",
  },
  {
    q: "How do I become a NexClean specialist?",
    a: "Head to the Become an agent link in our footer, complete the sign-up form and KYC verification, and you can start accepting jobs once approved.",
  },
  {
    q: "How do refunds work?",
    a: "See our Refund policy page for the full details — in short, cancellations before a specialist is dispatched are refunded in full.",
  },
];

export function Help() {
  return (
    <StaticPageShell
      eyebrow="Help center"
      title="Answers to common questions."
      subtitle="Can't find what you're looking for? Reach out via our Contact page."
    >
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-card border border-line bg-surface/60 p-5 open:bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
              {f.q}
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </StaticPageShell>
  );
}
