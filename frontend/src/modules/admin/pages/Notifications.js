import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Megaphone, Send, Check, Users, Bell, Smartphone } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatDate } from "@shared/lib/format";
import { useCampaigns, useSendCampaign, useAudienceSizes } from "../api/admin.api";
const AUDIENCES = ["All customers", "Active customers", "Lapsed customers", "Subscribers"];
export function Notifications() {
    const { data: campaigns = [] } = useCampaigns();
    const { data: audienceSizes } = useAudienceSizes();
    const sendCampaign = useSendCampaign();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [audience, setAudience] = useState(AUDIENCES[0]);
    const [sent, setSent] = useState(null);
    const send = async () => {
        if (!title.trim() || !body.trim())
            return;
        const campaign = await sendCampaign.mutateAsync({ title: title.trim(), body: body.trim(), audience });
        setSent(campaign.sentCount);
        setTitle("");
        setBody("");
        setTimeout(() => setSent(null), 2500);
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Push Notifications" }), _jsx("p", { className: "mt-1 text-muted", children: "Send manual campaigns to your customers via Firebase Cloud Messaging (FCM)." })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.3fr_1fr]", children: [_jsxs(GlassCard, { className: "space-y-4", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "New campaign" }), _jsx(Input, { name: "title", label: "Title", placeholder: "e.g. Weekend Sparkle Offer", value: title, onChange: (e) => setTitle(e.target.value) }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Message" }), _jsx("textarea", { rows: 3, value: body, onChange: (e) => setBody(e.target.value), placeholder: "What do you want to tell your customers?", className: "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Audience" }), _jsx("div", { className: "flex flex-wrap gap-2", children: AUDIENCES.map((a) => (_jsxs("button", { onClick: () => setAudience(a), className: cn("rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors", audience === a
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-line bg-surface text-muted hover:text-ink"), children: [a, audienceSizes && (_jsxs("span", { className: "ml-1 text-xs opacity-70", children: ["(", (audienceSizes[a] ?? 0).toLocaleString("en-IN"), ")"] }))] }, a))) })] }), _jsx("div", { className: "flex items-center gap-3 pt-1", children: _jsx(Button, { onClick: send, disabled: !title.trim() || !body.trim() || sendCampaign.isPending, children: sent !== null ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "size-4" }), " Sent to ", sent.toLocaleString("en-IN")] })) : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "size-4" }), " Send campaign"] })) }) })] }), _jsxs(GlassCard, { children: [_jsx("p", { className: "mb-3 text-xs font-medium uppercase tracking-wide text-muted", children: "Preview" }), _jsx("div", { className: "rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white", children: _jsx(Megaphone, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: title || "Your campaign title" }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted", children: body || "Your message preview appears here." }), _jsxs("p", { className: "mt-2 inline-flex items-center gap-1 text-[11px] text-muted", children: [_jsx(Users, { className: "size-3" }), " ", audience] })] })] }) })] })] }), _jsxs(GlassCard, { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Campaign history" }), _jsx("div", { className: "mt-4 space-y-3", children: campaigns.map((c) => (_jsxs("div", { className: "flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-4", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary", children: _jsx(Megaphone, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium text-ink", children: c.title }), _jsx("p", { className: "truncate text-sm text-muted", children: c.body }), _jsxs("p", { className: "mt-1 text-xs text-muted", children: [c.audience, " \u00B7 ", formatDate(c.createdAt)] }), _jsxs("div", { className: "mt-1.5 flex items-center gap-3 text-[11px] text-muted", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Bell, { className: "size-3" }), " ", c.pushDelivered.toLocaleString("en-IN"), " push"] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Smartphone, { className: "size-3" }), " ", c.inAppOnly.toLocaleString("en-IN"), " in-app only"] })] })] }), _jsx("span", { className: "shrink-0 text-sm font-semibold text-primary", children: c.sentCount.toLocaleString("en-IN") })] }, c.id))) })] })] }));
}
