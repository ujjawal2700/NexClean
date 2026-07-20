import { Phone, Mail, MapPin, Headphones, ShieldCheck, MessageSquare, ArrowRight } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Container } from "@shared/components/layout/Container";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function Support() {
  return (
    <div className="min-h-dvh bg-bg">
      <Navbar />


      <main className="relative pt-24 pb-20 overflow-hidden">
        <Aurora />

        <Container className="relative z-10 max-w-5xl space-y-12">
          {/* Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Headphones className="size-3.5" /> 24/7 Dedicated Assistance
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-ink tracking-tight">
              Customer <span className="text-gradient">Support &amp; Contact</span>
            </h1>
            <p className="text-muted text-base leading-relaxed">
              We're here to help! Whether you have questions about your bookings, subscriptions, agent onboarding, or account recovery, reach out to our team anytime.
            </p>
          </div>

          {/* Primary Contact Cards Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Phone Support */}
            <GlassCard className="p-6 space-y-4 border border-line bg-surface hover:border-primary/30 transition-all">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Phone className="size-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Phone Support</h3>
                <p className="text-xs text-muted mt-1">Speak directly with our support team</p>
              </div>
              <div className="pt-2 border-t border-line/50">
                <p className="font-display text-lg font-bold text-ink">+91 98765 43210</p>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">Mon–Sun: 7:00 AM – 9:00 PM</p>
              </div>
              <a href="tel:+919876543210" className="block pt-2">
                <Button variant="outline" className="w-full justify-between group">
                  <span>Call Us Now</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </GlassCard>

            {/* Email Support */}
            <GlassCard className="p-6 space-y-4 border border-line bg-surface hover:border-primary/30 transition-all">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="size-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Email Support</h3>
                <p className="text-xs text-muted mt-1">For inquiries, complaints &amp; account issues</p>
              </div>
              <div className="pt-2 border-t border-line/50">
                <p className="font-display text-base font-bold text-ink truncate">support@nexclean.in</p>
                <p className="text-xs text-muted mt-0.5">Average response time: &lt; 2 hours</p>
              </div>
              <a href="mailto:support@nexclean.in" className="block pt-2">
                <Button variant="outline" className="w-full justify-between group">
                  <span>Send an Email</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </GlassCard>

            {/* Office Headquarters */}
            <GlassCard className="p-6 space-y-4 border border-line bg-surface hover:border-primary/30 transition-all">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MapPin className="size-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Head Office</h3>
                <p className="text-xs text-muted mt-1">Visit our operations office</p>
              </div>
              <div className="pt-2 border-t border-line/50">
                <p className="text-sm font-medium text-ink leading-snug">
                  NexClean HQ, 102 Sector 5, HSR Layout, Bengaluru, Karnataka 560102
                </p>
              </div>
              <a
                href="https://maps.google.com/?q=HSR+Layout+Bengaluru"
                target="_blank"
                rel="noreferrer"
                className="block pt-2"
              >
                <Button variant="outline" className="w-full justify-between group">
                  <span>Get Directions</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </GlassCard>
          </div>

          {/* Service Guarantee Banner */}
          <GlassCard className="p-8 bg-gradient-to-r from-primary/10 via-surface to-surface border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg">
                <ShieldCheck className="size-7" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink">100% Satisfaction Guarantee</h3>
                <p className="text-sm text-muted mt-1 max-w-xl">
                  Not happy with your vehicle clean? Contact our support team within 24 hours of your appointment for a free re-wash or full refund.
                </p>
              </div>
            </div>
            <a href="tel:+919876543210" className="shrink-0 w-full md:w-auto">
              <Button size="lg" className="w-full md:w-auto gap-2">
                <MessageSquare className="size-4" /> Talk to Support
              </Button>
            </a>
          </GlassCard>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
