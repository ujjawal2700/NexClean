import { Mail, Phone, MapPin } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";

const CHANNELS = [
  { icon: Mail, label: "Email", value: "support@nexclean.in", href: "mailto:support@nexclean.in" },
  { icon: Phone, label: "Phone", value: "+91 98765 43210", href: "tel:+919876543210" },
  { icon: MapPin, label: "Head office", value: "Bengaluru, Karnataka, India", href: undefined },
];

export function Contact() {
  return (
    <StaticPageShell
      eyebrow="Contact"
      title="We're happy to help."
      subtitle="Questions about a booking, a subscription, or becoming a specialist — reach us directly through any of these channels."
    >
      <ul className="list-none! space-y-4 pl-0!">
        {CHANNELS.map((c) => (
          <li key={c.label} className="flex items-center gap-4 rounded-card border border-line bg-surface/60 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <c.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{c.label}</p>
              {c.href ? (
                <a href={c.href} className="text-sm font-medium text-ink no-underline">
                  {c.value}
                </a>
              ) : (
                <p className="text-sm font-medium text-ink">{c.value}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h2>Already have a booking?</h2>
      <p>
        For the fastest help with an active or upcoming booking, email us with your registered
        phone number and booking date — our team can pull up the details right away.
      </p>
    </StaticPageShell>
  );
}
