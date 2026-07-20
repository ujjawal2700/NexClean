import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const go = (href) => {
        setOpen(false);
        goToSection(href);
    };
    const goHome = () => {
        setOpen(false);
        if (location.pathname === "/") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        else {
            navigate("/");
        }
    };
    return (_jsx("header", { className: "fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4", children: _jsxs("nav", { className: cn("w-full max-w-[1180px] rounded-[1.75rem] transition-all duration-500 ease-[var(--ease-out-expo)]", scrolled ? "glass shadow-[var(--shadow-soft)]" : "border border-transparent"), children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-2.5", children: [_jsx("button", { onClick: goHome, className: "text-[1.2rem]", "aria-label": "NexClean home", children: _jsx(Logo, { variant: "full" }) }), _jsx("ul", { className: "hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex", children: LINKS.map((link) => (_jsx("li", { children: _jsx("button", { onClick: () => go(link.href), className: "transition-colors hover:text-primary", children: link.label }) }, link.label))) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "hidden sm:inline-flex", onClick: () => navigate("/app/login"), children: "Sign in" }), _jsx(Button, { size: "sm", onClick: () => go("#plans"), children: "Book cleaning" }), _jsx("button", { className: "grid size-9 place-items-center rounded-full text-ink md:hidden", onClick: () => setOpen((o) => !o), "aria-label": "Toggle menu", children: open ? _jsx(X, { className: "size-5" }) : _jsx(Menu, { className: "size-5" }) })] })] }), open && (_jsx("div", { className: "border-t border-line/60 px-5 py-3 md:hidden", children: _jsxs("ul", { className: "flex flex-col gap-1", children: [LINKS.map((link) => (_jsx("li", { children: _jsx("button", { onClick: () => go(link.href), className: "w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft hover:bg-surface-muted", children: link.label }) }, link.label))), _jsx("li", { className: "sm:hidden", children: _jsx("button", { onClick: () => navigate("/app/login"), className: "w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-soft hover:bg-surface-muted", children: "Sign in" }) })] }) }))] }) }));
}
