import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Hero } from "./sections/Hero";
import { EmotionalStory } from "./sections/EmotionalStory";
import { ProblemSolution } from "./sections/ProblemSolution";
import { HowItWorks } from "./sections/HowItWorks";
import { VehicleCategories } from "./sections/VehicleCategories";
import { SmartAreaAlert } from "./sections/SmartAreaAlert";
import { WhyChoose } from "./sections/WhyChoose";
import { Subscriptions } from "./sections/Subscriptions";
import { AppShowcase } from "./sections/AppShowcase";
import { Testimonials } from "./sections/Testimonials";
import { Stats } from "./sections/Stats";
import { FinalCTA } from "./sections/FinalCTA";

/**
 * The full story-driven landing page — scrolls like a movie:
 * hero → emotion → problem/solution → how → vehicles → the USP →
 * why → plans → app → reviews → stats → final CTA.
 */
export function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pill focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <EmotionalStory />
        <ProblemSolution />
        <HowItWorks />
        <VehicleCategories />
        <SmartAreaAlert />
        <WhyChoose />
        <Subscriptions />
        <AppShowcase />
        <Testimonials />
        <Stats />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
