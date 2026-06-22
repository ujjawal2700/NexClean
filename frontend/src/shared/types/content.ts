/** Site content managed from the admin panel and consumed by the landing site. */

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type Footer = {
  tagline: string;
  columns: FooterColumn[];
  /** Bottom bar text. `{year}` is replaced with the current year. */
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
export type ProsePageKey = keyof Pages;

export type ContactChannelType = "email" | "phone" | "address";
export type ContactChannel = { type: ContactChannelType; label: string; value: string; href: string };
export type Contact = { eyebrow: string; title: string; subtitle: string; body: string; channels: ContactChannel[] };

export type Faq = { q: string; a: string };
export type Help = { eyebrow: string; title: string; subtitle: string; faqs: Faq[] };

// ── Landing page sections ───────────────────────────────────────────────────
// Text is editable; icons, animations and decorative mockups stay in code.

export type SectionHeading = { eyebrow: string; title: string; subtitle: string };

export type HeroContent = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  /** Three trust indicators; icons are fixed in code. */
  trust: string[];
};

export type EmotionalStoryContent = {
  badge: string;
  title: string;
  body: string;
  caption: string;
  moments: string[];
};

export type ProblemSolutionContent = SectionHeading & {
  oldWayLabel: string;
  newWayLabel: string;
  problems: string[];
  solutions: string[];
};

export type Step = { title: string; body: string };
export type HowItWorksContent = SectionHeading & { steps: Step[] };

export type SmartAreaAlertContent = {
  badge: string;
  title: string;
  body: string;
  features: string[];
};

export type Reason = { title: string; body: string };
export type WhyChooseContent = SectionHeading & { reasons: Reason[] };

export type SubscriptionsSectionContent = SectionHeading & { footnote: string };

export type AppShowcaseContent = {
  badge: string;
  title: string;
  body: string;
  features: string[];
};

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
