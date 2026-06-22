/**
 * Default site content, mirroring what the landing site originally hard-coded.
 * Seeded into the SiteContent singleton on first access; admins edit it from there.
 */

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type Footer = {
  tagline: string;
  columns: FooterColumn[];
  /** Bottom bar text. `{year}` is replaced with the current year by the client. */
  bottomLeft: string;
  bottomRight: string;
};

export type ProsePage = { eyebrow: string; title: string; subtitle: string; body: string };
export type Pages = {
  about: ProsePage;
  careers: ProsePage;
  privacy: ProsePage;
  terms: ProsePage;
  refund: ProsePage;
};

export type ContactChannel = { type: "email" | "phone" | "address"; label: string; value: string; href: string };
export type Contact = { eyebrow: string; title: string; subtitle: string; body: string; channels: ContactChannel[] };

export type Faq = { q: string; a: string };
export type Help = { eyebrow: string; title: string; subtitle: string; faqs: Faq[] };

export type SectionHeading = { eyebrow: string; title: string; subtitle: string };
export type HeroContent = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  trust: string[];
};
export type EmotionalStoryContent = { badge: string; title: string; body: string; caption: string; moments: string[] };
export type ProblemSolutionContent = SectionHeading & {
  oldWayLabel: string;
  newWayLabel: string;
  problems: string[];
  solutions: string[];
};
export type Step = { title: string; body: string };
export type HowItWorksContent = SectionHeading & { steps: Step[] };
export type SmartAreaAlertContent = { badge: string; title: string; body: string; features: string[] };
export type Reason = { title: string; body: string };
export type WhyChooseContent = SectionHeading & { reasons: Reason[] };
export type SubscriptionsSectionContent = SectionHeading & { footnote: string };
export type AppShowcaseContent = { badge: string; title: string; body: string; features: string[] };
export type Review = { name: string; role: string; initials: string; quote: string };
export type TestimonialsContent = SectionHeading & { reviews: Review[] };
export type StatItem = { value: number; decimals?: number; suffix: string; label: string };
export type StatsContent = { items: StatItem[] };
export type FinalCtaContent = { title: string; body: string; primaryCta: string; secondaryCta: string };
export type Landing = {
  hero: HeroContent;
  emotionalStory: EmotionalStoryContent;
  problemSolution: ProblemSolutionContent;
  howItWorks: HowItWorksContent;
  vehicleCategories: SectionHeading;
  smartAreaAlert: SmartAreaAlertContent;
  whyChoose: WhyChooseContent;
  subscriptions: SubscriptionsSectionContent;
  appShowcase: AppShowcaseContent;
  testimonials: TestimonialsContent;
  stats: StatsContent;
  finalCta: FinalCtaContent;
};

export type SiteContent = { footer: Footer; pages: Pages; contact: Contact; help: Help; landing: Landing };

export const DEFAULT_CONTENT: SiteContent = {
  footer: {
    tagline: "Premium on-demand vehicle care, delivered to your doorstep. Your car. Our care.",
    columns: [
      {
        title: "Service",
        links: [
          { label: "How it works", href: "#how-it-works" },
          { label: "Vehicle types", href: "#vehicles" },
          { label: "Subscription plans", href: "#plans" },
          { label: "NexClean Nearby", href: "#nearby" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About us", href: "/about" },
          { label: "Careers", href: "/careers" },
          { label: "Become an agent", href: "/agent/signup" },
          { label: "Contact", href: "/contact" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Help center", href: "/help" },
          { label: "Privacy policy", href: "/privacy" },
          { label: "Terms of service", href: "/terms" },
          { label: "Refund policy", href: "/refund" },
        ],
      },
    ],
    bottomLeft: "© {year} NexClean. All rights reserved.",
    bottomRight: "Made with care for cars everywhere.",
  },

  pages: {
    about: {
      eyebrow: "About NexClean",
      title: "Premium car care, brought to your doorstep.",
      subtitle:
        "We started NexClean because washing your own car — or driving across town for a wash — shouldn't be the cost of keeping it looking great.",
      body: [
        "## Our story",
        "",
        "NexClean began with a simple frustration: great car care meant either spending a weekend morning doing it yourself, or driving to a service center and waiting around. We built a platform where certified specialists come to you instead — at home, at the office, or wherever you've parked — and your car gets the same premium treatment without the detour.",
        "",
        "## What we believe",
        "",
        "Convenience shouldn't mean compromise. Every specialist on NexClean is vetted and trained, every booking is tracked end-to-end, and every plan is built to fit how often you actually drive — not a one-size-fits-all schedule.",
        "",
        "## Where we're headed",
        "",
        "We're expanding city by city, building tools like NexClean Nearby so specialists already in your area can reach you faster, and investing in the parts of the experience customers notice most: reliability, transparency, and a team that shows up on time.",
      ].join("\n"),
    },
    careers: {
      eyebrow: "Careers",
      title: "Help us build the future of car care.",
      subtitle:
        "We're a small team moving fast — and we're always looking to talk to people who care about craft, reliability, and good design.",
      body: [
        "## Open roles",
        "",
        "We don't have specific openings posted right now, but we're growing across engineering, operations, and city launches. If you think you'd be a strong fit for NexClean, we'd still like to hear from you.",
        "",
        "## Get in touch",
        "",
        "Send us a note with what you're interested in and a bit about yourself — no formal application needed.",
        "",
        "[careers@nexclean.in](mailto:careers@nexclean.in)",
        "",
        "## Become an agent instead?",
        "",
        "If you're looking to clean vehicles on NexClean as a service specialist rather than join our core team, head to [agent sign-up](/agent/signup) instead.",
      ].join("\n"),
    },
    privacy: {
      eyebrow: "Legal",
      title: "Privacy policy",
      subtitle: "Last updated June 2026. This page explains what we collect, why, and how you can control it.",
      body: [
        "## What we collect",
        "",
        "To book and deliver a cleaning service, we collect your name, phone number, email, addresses you book at, vehicle details, and payment information processed through our payment partner. Specialists submit identity and KYC documents during sign-up so customers can trust who's arriving at their door.",
        "",
        "## How we use it",
        "",
        "- To schedule, assign, and track bookings between you and a specialist.",
        "- To send booking confirmations, status updates, and NexClean Nearby offers.",
        "- To verify specialist identity and eligibility to operate on the platform.",
        "- To improve service quality, pricing, and coverage in your area.",
        "",
        "## What we don't do",
        "",
        "We don't sell your personal data to third parties. Location data is only used to match you with nearby specialists and is not shared beyond what's needed to fulfill a booking.",
        "",
        "## Your controls",
        "",
        "You can update or delete your account information from your profile at any time, or contact us to request a copy or deletion of your data.",
        "",
        "## Contact",
        "",
        "Questions about this policy? Reach us at [privacy@nexclean.in](mailto:privacy@nexclean.in).",
      ].join("\n"),
    },
    terms: {
      eyebrow: "Legal",
      title: "Terms of service",
      subtitle: "Last updated June 2026. By booking through NexClean, you agree to the terms below.",
      body: [
        "## Bookings",
        "",
        "When you book a cleaning, you're requesting a specialist to attend the location and time you specify. Please ensure the vehicle is accessible and reasonably free of personal belongings at the scheduled time.",
        "",
        "## Subscriptions",
        "",
        "Subscription plans renew automatically each billing cycle until cancelled. You can cancel anytime from your account; access continues until the end of the current billing period.",
        "",
        "## Specialists",
        "",
        "Specialists on NexClean are independent professionals who complete our verification and KYC process before accepting jobs. NexClean facilitates the booking and payment but specialists are responsible for the quality of service delivered.",
        "",
        "## Acceptable use",
        "",
        "- Provide accurate booking details — incorrect addresses or vehicle info may delay service.",
        "- Treat specialists with respect; abusive behavior may result in account suspension.",
        "- Don't use the platform for any unlawful purpose.",
        "",
        "## Liability",
        "",
        "NexClean takes reasonable care in vetting specialists, but is not liable for pre-existing vehicle damage. Any service-related damage should be reported within 24 hours so we can investigate with the specialist involved.",
        "",
        "## Changes to these terms",
        "",
        "We may update these terms as the service evolves. Continued use of NexClean after an update means you accept the revised terms.",
      ].join("\n"),
    },
    refund: {
      eyebrow: "Legal",
      title: "Refund policy",
      subtitle: "Last updated June 2026. We want every booking to feel risk-free.",
      body: [
        "## One-off bookings",
        "",
        "- Cancel before a specialist is dispatched — full refund, no questions asked.",
        "- Cancel after dispatch but before the specialist arrives — partial refund, minus a small dispatch fee.",
        "- Not satisfied with the service — contact us within 24 hours and we'll arrange a re-clean or refund.",
        "",
        "## Subscriptions",
        "",
        "Unused washes don't carry a per-wash refund, but you can cancel your subscription anytime and you'll keep access until the end of the current billing period — no further charges after that.",
        "",
        "## How refunds are paid",
        "",
        "Approved refunds are returned to your original payment method and typically reflect within 5–7 business days, depending on your bank.",
        "",
        "## Need a refund?",
        "",
        "Reach out via our [Contact](/contact) page with your booking details and we'll take it from there.",
      ].join("\n"),
    },
  },

  contact: {
    eyebrow: "Contact",
    title: "We're happy to help.",
    subtitle:
      "Questions about a booking, a subscription, or becoming a specialist — reach us directly through any of these channels.",
    channels: [
      { type: "email", label: "Email", value: "support@nexclean.in", href: "mailto:support@nexclean.in" },
      { type: "phone", label: "Phone", value: "+91 98765 43210", href: "tel:+919876543210" },
      { type: "address", label: "Head office", value: "Bengaluru, Karnataka, India", href: "" },
    ],
    body: [
      "## Already have a booking?",
      "",
      "For the fastest help with an active or upcoming booking, email us with your registered phone number and booking date — our team can pull up the details right away.",
    ].join("\n"),
  },

  help: {
    eyebrow: "Help center",
    title: "Answers to common questions.",
    subtitle: "Can't find what you're looking for? Reach out via our Contact page.",
    faqs: [
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
    ],
  },

  landing: {
    hero: {
      badge: "Premium On-Demand Vehicle Care",
      title: "Premium car care, delivered to your doorstep.",
      subtitle:
        "Schedule professional cleaning in seconds. Certified specialists arrive at your location and transform your vehicle — while you relax.",
      primaryCta: "Book cleaning",
      secondaryCta: "Watch how it works",
      trust: ["Verified professionals", "4.9 average rating", "15+ cities"],
    },
    emotionalStory: {
      badge: "Care Beyond Cleaning",
      title: "Your car deserves more than a quick wash.",
      body: "It's part of your everyday — the drives, the trips, the routines. We treat every detail with the care it deserves, so it always feels at its best.",
      caption: "Cared for like it's our own — every single visit.",
      moments: ["Family road trips", "Weekend drives", "Your first car", "Late-night journeys"],
    },
    problemSolution: {
      eyebrow: "The Old Way vs NexClean",
      title: "Car care, finally done right.",
      subtitle: "Everything frustrating about a traditional car wash — solved by bringing the service to you.",
      oldWayLabel: "The old way",
      newWayLabel: "The NexClean way",
      problems: [
        "Long waiting queues at the wash",
        "Driving across town to a center",
        "Unprofessional, untrained cleaners",
        "Inconsistent, unreliable quality",
      ],
      solutions: [
        "Book in 30 seconds, anytime",
        "A specialist arrives at your location",
        "Verified, certified professionals",
        "Real-time updates, every step",
      ],
    },
    howItWorks: {
      eyebrow: "How NexClean Works",
      title: "Sparkling clean in six simple steps.",
      subtitle: "From booking to brilliance — the whole journey takes seconds to start.",
      steps: [
        { title: "Choose vehicle", body: "Pick your car type in a tap." },
        { title: "Select package", body: "From quick wash to full detail." },
        { title: "Pick date & time", body: "Whenever suits your day." },
        { title: "Cleaner assigned", body: "A verified specialist is matched." },
        { title: "We come to you", body: "They arrive right at your doorstep." },
        { title: "Enjoy the shine", body: "Sit back. We handle the rest." },
      ],
    },
    vehicleCategories: {
      eyebrow: "Vehicle Categories",
      title: "Tailored care for every car.",
      subtitle: "Transparent pricing by vehicle type — no surprises, ever.",
    },
    smartAreaAlert: {
      badge: "The Signature Feature",
      title: "NexClean Nearby — care that finds you.",
      body: "When a specialist arrives in your area, nearby customers get a personalized offer to clean their vehicle too — instantly. The admin sets the radius, rules, and message.",
      features: [
        "Smart radius detection around the active specialist",
        "Personalized push notifications via Firebase Cloud Messaging",
        "Fully customizable templates, radius & trigger rules",
      ],
    },
    whyChoose: {
      eyebrow: "Why NexClean",
      title: "Premium care, total peace of mind.",
      subtitle: "Every detail engineered around trust, quality, and your convenience.",
      reasons: [
        { title: "Verified Professionals", body: "Background-checked, trained specialists." },
        { title: "On-Time, Every Time", body: "Punctual service that respects your day." },
        { title: "Eco-Friendly Products", body: "Safe for your car and the planet." },
        { title: "Doorstep Service", body: "Home, office, or society — we come to you." },
        { title: "Secure Payments", body: "UPI, cards, wallets — fully protected." },
        { title: "Flexible Scheduling", body: "Book any slot that fits your day." },
        { title: "Premium Standards", body: "Showroom-grade finish, every time." },
        { title: "Insured Staff", body: "Complete peace of mind, guaranteed." },
      ],
    },
    subscriptions: {
      eyebrow: "Subscription Plans",
      title: "Care that keeps your car its best.",
      subtitle: "Switch from one-off washes to effortless, recurring care — and always save more.",
      footnote: "Prices are indicative and configurable by the admin. Cancel anytime.",
    },
    appShowcase: {
      badge: "The NexClean App",
      title: "Your car care, in your pocket.",
      body: "Book, track, pay, and manage every wash from one beautifully simple app.",
      features: ["Booking", "Subscriptions", "Notifications", "Payments", "Service history"],
    },
    testimonials: {
      eyebrow: "Loved By Owners",
      title: "Trusted by people who love their cars.",
      subtitle: "Join thousands who've made doorstep care their new normal.",
      reviews: [
        {
          name: "Aarav Mehta",
          role: "BMW 5 Series owner",
          initials: "AM",
          quote:
            "It feels like valet service for my car. They arrived on time, and the finish was genuinely showroom quality.",
        },
        {
          name: "Priya Sharma",
          role: "Hyundai Creta owner",
          initials: "PS",
          quote: "I got the NexClean Nearby alert while working from home and booked in seconds. Absolute game-changer.",
        },
        {
          name: "Rohan Verma",
          role: "Mahindra Thar owner",
          initials: "RV",
          quote:
            "Tracking the specialist live, eco-friendly products, spotless results. I've moved my whole family to the Elite plan.",
        },
      ],
    },
    stats: {
      items: [
        { value: 50000, suffix: "+", label: "Vehicles cleaned" },
        { value: 100, suffix: "+", label: "Professional agents" },
        { value: 4.9, decimals: 1, suffix: "★", label: "Average rating" },
        { value: 15, suffix: "+", label: "Cities served" },
      ],
    },
    finalCta: {
      title: "Give your vehicle the care it deserves.",
      body: "Book in 30 seconds. A certified specialist comes to you. It's that simple.",
      primaryCta: "Book your cleaning",
      secondaryCta: "View plans",
    },
  },
};
