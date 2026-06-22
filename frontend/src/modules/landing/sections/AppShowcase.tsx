import { CalendarCheck, Repeat, Bell, Wallet, History, Apple, Play } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { PhoneMockup } from "@shared/components/visual/PhoneMockup";
import { useSiteContent } from "@shared/hooks/useSiteContent";

// Icons for the quick-action mockup grid and the feature pills (labels are editable).
const FEATURE_ICONS = [CalendarCheck, Repeat, Bell, Wallet, History];

const FEATURES = [
  { icon: CalendarCheck, label: "Booking" },
  { icon: Repeat, label: "Subscriptions" },
  { icon: Bell, label: "Notifications" },
  { icon: Wallet, label: "Payments" },
  { icon: History, label: "Service history" },
];

function HomeScreen() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted">Good morning</p>
          <p className="font-display text-sm font-semibold text-ink">Your garage</p>
        </div>
        <span className="size-8 rounded-full bg-primary/10" />
      </div>

      <div className="mt-3 rounded-2xl bg-gradient-to-br from-primary to-accent p-3 text-white">
        <p className="text-[10px] opacity-80">Next wash</p>
        <p className="text-sm font-semibold">Tomorrow · 9:00 AM</p>
        <div className="mt-2 flex items-center gap-1 text-[10px]">
          <CalendarCheck className="size-3" /> Confirmed
        </div>
      </div>

      <p className="mt-4 text-[10px] font-medium uppercase tracking-wide text-muted">Quick actions</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {FEATURES.slice(0, 6).map((f) => (
          <div key={f.label} className="grid aspect-square place-items-center rounded-xl border border-line bg-surface">
            <f.icon className="size-4 text-primary" />
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-2xl border border-line bg-surface p-3">
        <p className="text-[10px] text-muted">This month</p>
        <p className="text-sm font-semibold text-ink">3 washes · ₹1,197 saved</p>
      </div>
    </div>
  );
}

export function AppShowcase() {
  const { appShowcase: c } = useSiteContent().landing;
  const features = c.features.map((label, i) => ({ label, Icon: FEATURE_ICONS[i] ?? CalendarCheck }));
  return (
    <Section id="app" className="relative overflow-hidden border-t border-line/60">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <Reveal>
            <Badge>{c.badge}</Badge>
          </Reveal>
          <SplitReveal
            onScroll
            as="h2"
            text={c.title}
            className="mt-5 max-w-[14ch] text-4xl text-ink sm:text-5xl"
          />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg text-muted">{c.body}</p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap gap-3">
              {features.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface/70 px-4 py-2 text-sm text-ink-soft"
                >
                  <f.Icon className="size-4 text-primary" /> {f.label}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" disabled title="Coming soon">
                <Apple className="size-5" /> App Store · Coming soon
              </Button>
              <Button variant="outline" disabled title="Coming soon">
                <Play className="size-5 fill-current" /> Google Play · Coming soon
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Floating phones */}
        <Reveal>
          <div className="relative mx-auto flex h-[420px] items-center justify-center">
            <div className="absolute z-10" style={{ animation: "float-y 6s ease-in-out infinite" }}>
              <PhoneMockup>
                <HomeScreen />
              </PhoneMockup>
            </div>
            <div
              className="absolute -right-2 top-6 hidden rotate-6 opacity-90 sm:block"
              style={{ animation: "float-y 7s ease-in-out infinite 0.5s" }}
            >
              <PhoneMockup className="w-[200px] scale-90">
                <div className="grid h-full place-items-center bg-gradient-to-br from-primary to-accent p-6 text-center text-white">
                  <div>
                    <Bell className="mx-auto size-8" />
                    <p className="mt-3 text-sm font-semibold">NexClean Nearby</p>
                    <p className="mt-1 text-[11px] opacity-85">A specialist is in your area</p>
                  </div>
                </div>
              </PhoneMockup>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
