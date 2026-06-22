import type { SiteContent } from "@shared/types/content";

/**
 * Client-side fallback for site content — mirrors the backend defaults so the
 * landing site renders instantly before the API responds. Once `/catalog/content`
 * loads, the live (admin-edited) values take over.
 */
export const DEFAULT_SITE_CONTENT: SiteContent = {
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
      body: "",
    },
    careers: {
      eyebrow: "Careers",
      title: "Help us build the future of car care.",
      subtitle:
        "We're a small team moving fast — and we're always looking to talk to people who care about craft, reliability, and good design.",
      body: "",
    },
    privacy: {
      eyebrow: "Legal",
      title: "Privacy policy",
      subtitle: "Last updated June 2026. This page explains what we collect, why, and how you can control it.",
      body: "",
    },
    terms: {
      eyebrow: "Legal",
      title: "Terms of service",
      subtitle: "Last updated June 2026. By booking through NexClean, you agree to the terms below.",
      body: "",
    },
    refund: {
      eyebrow: "Legal",
      title: "Refund policy",
      subtitle: "Last updated June 2026. We want every booking to feel risk-free.",
      body: "",
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
    body: "",
  },
  help: {
    eyebrow: "Help center",
    title: "Answers to common questions.",
    subtitle: "Can't find what you're looking for? Reach out via our Contact page.",
    faqs: [],
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
