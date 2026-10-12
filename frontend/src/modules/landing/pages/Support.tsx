import { Phone, Mail, MapPin, Headphones, MessageSquare, ArrowRight } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Container } from "@shared/components/layout/Container";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export function Support() {
  const { contact } = useSiteContent();
  const primary = contact.channels.find(channel => channel.type === "phone" && channel.href)
    ?? contact.channels.find(channel => channel.type === "email" && channel.href);

  return (
    <div className="min-h-dvh bg-bg">
      <Navbar />
      <main className="relative overflow-hidden pb-20 pt-24">
        <Aurora />
        <Container className="relative z-10 max-w-5xl space-y-12">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Headphones className="size-3.5" /> Customer support
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Customer <span className="text-gradient">Support &amp; Contact</span></h1>
            <p className="text-muted">Get help with bookings, subscriptions, agent onboarding, or account recovery through our published contact channels.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {contact.channels.map(channel => {
              const Icon = channel.type === "phone" ? Phone : channel.type === "email" ? Mail : MapPin;
              const action = channel.type === "phone" ? "Call support" : channel.type === "email" ? "Send an email" : "Get directions";
              return (
                <GlassCard key={channel.type + channel.label} className="min-w-0 space-y-4 border border-line bg-surface p-6">
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
                  <h2 className="font-display text-lg font-semibold text-ink">{channel.label}</h2>
                  <p className="break-words text-sm text-ink">{channel.value}</p>
                  {channel.href && <Button asChild variant="outline" className="min-h-[48px] w-full justify-between">
                    <a href={channel.href}><span>{action}</span><ArrowRight className="size-4" /></a>
                  </Button>}
                </GlassCard>
              );
            })}
          </div>
          <GlassCard className="flex flex-col items-start justify-between gap-6 border border-primary/20 bg-primary/5 p-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Need help with a service?</h2>
              <p className="mt-2 max-w-xl text-sm text-muted">Share your registered mobile number, booking details, and a description of the issue so our team can help.</p>
              <a href="/refund" className="mt-2 inline-block text-sm font-medium text-primary underline">Read our refund and cancellation policy</a>
            </div>
            <Button asChild className="min-h-[48px] shrink-0"><a href={primary?.href ?? "/contact"}><MessageSquare className="size-4" /> Contact support</a></Button>
          </GlassCard>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
