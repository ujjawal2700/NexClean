import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { Logo } from "@shared/components/brand/Logo";
import { Container } from "@shared/components/layout/Container";
import { useSectionLink } from "@shared/hooks/useSectionLink";
import { useSiteContent } from "@shared/hooks/useSiteContent";
export function Footer() {
    const goToSection = useSectionLink();
    const { footer } = useSiteContent();
    return (_jsx("footer", { className: "border-t border-line/60 bg-surface/50", children: _jsxs(Container, { className: "py-16", children: [_jsxs("div", { className: "grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]", children: [_jsxs("div", { children: [_jsx(Logo, { variant: "full" }), _jsx("p", { className: "mt-5 max-w-xs text-sm text-muted", children: footer.tagline })] }), footer.columns.map((col) => (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: col.title }), _jsx("ul", { className: "mt-4 space-y-2.5", children: col.links.map((link) => (_jsx("li", { children: link.href.startsWith("#") ? (_jsx("button", { onClick: () => goToSection(link.href), className: "text-sm text-muted transition-colors hover:text-primary", children: link.label })) : (_jsx(Link, { to: link.href, className: "text-sm text-muted transition-colors hover:text-primary", children: link.label })) }, link.label))) })] }, col.title)))] }), _jsxs("div", { className: "mt-14 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-8 text-sm text-muted sm:flex-row", children: [_jsx("p", { children: footer.bottomLeft.replace("{year}", String(new Date().getFullYear())) }), _jsx("p", { children: footer.bottomRight })] })] }) }));
}
