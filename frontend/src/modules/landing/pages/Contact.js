import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Mail, Phone, MapPin } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";
const CHANNEL_ICON = {
    email: Mail,
    phone: Phone,
    address: MapPin,
};
export function Contact() {
    const { contact } = useSiteContent();
    return (_jsxs(StaticPageShell, { eyebrow: contact.eyebrow, title: contact.title, subtitle: contact.subtitle, children: [_jsx("ul", { className: "list-none! space-y-4 pl-0!", children: contact.channels.map((c) => {
                    const Icon = CHANNEL_ICON[c.type];
                    return (_jsxs("li", { className: "flex items-center gap-4 rounded-card border border-line bg-surface/60 p-4", children: [_jsx("span", { className: "grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary", children: _jsx(Icon, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-[0.14em] text-muted", children: c.label }), c.href ? (_jsx("a", { href: c.href, className: "text-sm font-medium text-ink no-underline", children: c.value })) : (_jsx("p", { className: "text-sm font-medium text-ink", children: c.value }))] })] }, c.label));
                }) }), _jsx(Markdown, { children: contact.body })] }));
}
