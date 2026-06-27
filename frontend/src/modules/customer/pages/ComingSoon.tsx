import { Link } from "react-router-dom";
import { Rocket, MapPin, Bell, CheckCircle2, ArrowLeft } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";

/**
 * Shown after a customer from an unserviced city verifies their number.
 * Their lead record has already been saved — this is the confirmation screen.
 */
export function ComingSoon() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <Aurora />
      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo variant="full" />
          </Link>
        </div>

        {/* Hero illustration */}
        <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_32px_rgba(251,146,60,0.35)]">
          <Rocket className="size-12 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-bold text-ink">You're on the list! 🎉</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We're not in your city yet, but we're growing fast. Your account is ready and your spot
          has been saved. We'll send you a notification the moment NexClean launches near you.
        </p>

        {/* What happens next */}
        <div className="mt-8 space-y-3 text-left">
          {[
            {
              icon: <CheckCircle2 className="size-5 text-green-500" />,
              title: "Account created",
              desc: "Your NexClean account is active and waiting.",
            },
            {
              icon: <MapPin className="size-5 text-amber-500" />,
              title: "City registered",
              desc: "Your location is on our expansion radar.",
            },
            {
              icon: <Bell className="size-5 text-primary" />,
              title: "Notification incoming",
              desc: "You'll be the first to know when we go live.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3"
            >
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 space-y-3">
          <Link to="/">
            <Button className="w-full" variant="outline">
              <ArrowLeft className="size-4" /> Back to home
            </Button>
          </Link>
          <p className="text-xs text-muted">
            Have questions?{" "}
            <a href="mailto:hello@nexclean.in" className="text-primary hover:underline">
              hello@nexclean.in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
