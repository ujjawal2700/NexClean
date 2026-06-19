import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
import { useSectionLink } from "@shared/hooks/useSectionLink";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Vehicles", href: "#vehicles" },
  { label: "NexClean Nearby", href: "#nearby" },
  { label: "Plans", href: "#plans" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const goToSection = useSectionLink();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    goToSection(href);
  };

  const goHome = () => {
    setOpen(false);
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "w-full max-w-[1180px] rounded-[1.75rem] transition-all duration-500 ease-[var(--ease-out-expo)]",
          scrolled ? "glass shadow-[var(--shadow-soft)]" : "border border-transparent",
        )}
      >
        <div className="flex items-center justify-between px-5 py-2.5">
          <button onClick={goHome} className="text-[1.2rem]" aria-label="NexClean home">
            <Logo variant="full" />
          </button>

          <ul className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
            {LINKS.map((link) => (
              <li key={link.label}>
                <button onClick={() => go(link.href)} className="transition-colors hover:text-primary">
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate("/app/login")}
            >
              Sign in
            </Button>
            <Button size="sm" onClick={() => go("#plans")}>
              Book cleaning
            </Button>
            <button
              className="grid size-9 place-items-center rounded-full text-ink md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* mobile menu */}
        {open && (
          <div className="border-t border-line/60 px-5 py-3 md:hidden">
            <ul className="flex flex-col gap-1">
              {LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => go(link.href)}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft hover:bg-surface-muted"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
              <li className="sm:hidden">
                <button
                  onClick={() => navigate("/app/login")}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft hover:bg-surface-muted"
                >
                  Sign in
                </button>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
}
