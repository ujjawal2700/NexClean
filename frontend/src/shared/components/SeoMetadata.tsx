import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE_URL } from "@shared/lib/site";

const SOCIAL_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_TITLE = "NexClean — Premium Car Care, Delivered To Your Doorstep";
const DEFAULT_DESCRIPTION =
  "Book professional doorstep car cleaning and detailing with trained NexClean specialists at your home, office, or society.";
const NOT_FOUND_PAGE = {
  title: "Page not found | NexClean",
  description: "The NexClean page you requested could not be found. Return home or contact customer support.",
};

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/about": {
    title: "About NexClean | Professional Doorstep Car Care",
    description: "Learn how NexClean makes reliable, professional vehicle care convenient at your doorstep.",
  },
  "/careers": {
    title: "Careers at NexClean | Join Our Team",
    description: "Explore opportunities to help NexClean build a trusted, technology-enabled car-care experience.",
  },
  "/contact": {
    title: "Contact NexClean | Get in Touch",
    description: "Contact the NexClean team for service, partnership, account, or business enquiries.",
  },
  "/support": {
    title: "NexClean Support | Booking and Account Help",
    description: "Get help with NexClean bookings, payments, subscriptions, accounts, and doorstep services.",
  },
  "/help": {
    title: "NexClean Help Centre | Frequently Asked Questions",
    description: "Find answers about NexClean services, bookings, cancellations, payments, and account security.",
  },
  "/privacy": {
    title: "Privacy Policy | NexClean",
    description: "Understand what personal information NexClean collects, why it is used, how it is protected, and your privacy choices.",
  },
  "/terms": {
    title: "Terms and Conditions | NexClean",
    description: "Read the terms that apply when you access NexClean or book and receive doorstep vehicle-care services.",
  },
  "/refund": {
    title: "Refund and Cancellation Policy | NexClean",
    description: "Review NexClean's booking cancellation, refund eligibility, processing, and support policy.",
  },
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/** Keep SPA navigation metadata, canonical URLs and indexing rules in sync. */
export function SeoMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
    const isPublicPage = Object.prototype.hasOwnProperty.call(PUBLIC_PAGES, normalizedPath);
    const isPrivateArea = /^\/(app|agent|admin)(\/|$)/.test(normalizedPath);
    const page = isPublicPage || isPrivateArea ? PUBLIC_PAGES[normalizedPath] ?? PUBLIC_PAGES["/"] : NOT_FOUND_PAGE;
    const canonicalPath = isPublicPage ? normalizedPath : "/";
    const canonicalUrl = `${SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`;
    const robots = isPublicPage ? "index,follow,max-image-preview:large" : "noindex,nofollow";

    document.title = page.title;
    setMeta('meta[name="description"]', "name", "description", page.description);
    setMeta('meta[name="robots"]', "name", "robots", robots);
    setMeta('meta[property="og:title"]', "property", "og:title", page.title);
    setMeta('meta[property="og:description"]', "property", "og:description", page.description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[property="og:image"]', "property", "og:image", SOCIAL_IMAGE);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", page.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", page.description);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", SOCIAL_IMAGE);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [pathname]);

  return null;
}
