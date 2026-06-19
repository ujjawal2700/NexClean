import { Link } from "react-router-dom";
import { Logo } from "@shared/components/brand/Logo";
import { Container } from "@shared/components/layout/Container";
import { useSectionLink } from "@shared/hooks/useSectionLink";

type FooterLink = { label: string; section: string } | { label: string; to: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Service",
    links: [
      { label: "How it works", section: "#how-it-works" },
      { label: "Vehicle types", section: "#vehicles" },
      { label: "Subscription plans", section: "#plans" },
      { label: "NexClean Nearby", section: "#nearby" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", to: "/about" },
      { label: "Careers", to: "/careers" },
      { label: "Become an agent", to: "/agent/signup" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", to: "/help" },
      { label: "Privacy policy", to: "/privacy" },
      { label: "Terms of service", to: "/terms" },
      { label: "Refund policy", to: "/refund" },
    ],
  },
];

export function Footer() {
  const goToSection = useSectionLink();

  return (
    <footer className="border-t border-line/60 bg-surface/50">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="full" />
            <p className="mt-5 max-w-xs text-sm text-muted">
              Premium on-demand vehicle care, delivered to your doorstep. Your car. Our care.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-ink">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"to" in link ? (
                      <Link
                        to={link.to}
                        className="text-sm text-muted transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <button
                        onClick={() => goToSection(link.section)}
                        className="text-sm text-muted transition-colors hover:text-primary"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-8 text-sm text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} NexClean. All rights reserved.</p>
          <p>Made with care for cars everywhere.</p>
        </div>
      </Container>
    </footer>
  );
}
