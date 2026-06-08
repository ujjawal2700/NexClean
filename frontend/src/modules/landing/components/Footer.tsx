import { Logo } from "@shared/components/brand/Logo";
import { Container } from "@shared/components/layout/Container";

const COLUMNS = [
  {
    title: "Service",
    links: ["How it works", "Vehicle types", "Subscription plans", "NexClean Nearby"],
  },
  {
    title: "Company",
    links: ["About us", "Careers", "Become an agent", "Contact"],
  },
  {
    title: "Support",
    links: ["Help center", "Privacy policy", "Terms of service", "Refund policy"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line/60 bg-surface/50">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="full" withTagline />
            <p className="mt-5 max-w-xs text-sm text-muted">
              Premium on-demand vehicle care, delivered to your doorstep. Your car. Our care.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-ink">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted transition-colors hover:text-primary">
                      {link}
                    </a>
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
