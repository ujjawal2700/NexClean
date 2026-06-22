import { Link } from "react-router-dom";
import { Logo } from "@shared/components/brand/Logo";
import { Container } from "@shared/components/layout/Container";
import { useSectionLink } from "@shared/hooks/useSectionLink";
import { useSiteContent } from "@shared/hooks/useSiteContent";

export function Footer() {
  const goToSection = useSectionLink();
  const { footer } = useSiteContent();

  return (
    <footer className="border-t border-line/60 bg-surface/50">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="full" />
            <p className="mt-5 max-w-xs text-sm text-muted">{footer.tagline}</p>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-ink">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("#") ? (
                      <button
                        onClick={() => goToSection(link.href)}
                        className="text-sm text-muted transition-colors hover:text-primary"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-muted transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-8 text-sm text-muted sm:flex-row">
          <p>{footer.bottomLeft.replace("{year}", String(new Date().getFullYear()))}</p>
          <p>{footer.bottomRight}</p>
        </div>
      </Container>
    </footer>
  );
}
