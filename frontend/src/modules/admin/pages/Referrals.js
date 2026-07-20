import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Gift, Users, Search, Calendar, Phone, ArrowRight, CheckCircle2, Award, Loader2, Sparkles, Coins, Save, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { Button } from "@shared/ui/Button";
import { useReferralLogs, useReferralConfig, useUpdateReferralConfig } from "../api/admin.api";
import { cn } from "@shared/lib/utils";
function ReferralSettingsSection() {
    const { data: config } = useReferralConfig();
    const update = useUpdateReferralConfig();
    const [referrerReward, setReferrerReward] = useState("");
    const [refereeReward, setRefereeReward] = useState("");
    const [coinsPerRupee, setCoinsPerRupee] = useState("");
    const [maxRedeemPercent, setMaxRedeemPercent] = useState("");
    const [active, setActive] = useState(true);
    // Sync local form state once the config loads.
    useEffect(() => {
        if (!config)
            return;
        setReferrerReward(String(config.referrerReward));
        setRefereeReward(String(config.refereeReward));
        setCoinsPerRupee(String(config.coinsPerRupee));
        setMaxRedeemPercent(String(config.maxRedeemPercent));
        setActive(config.active);
    }, [config]);
    const save = () => {
        update.mutate({
            referrerReward: Number(referrerReward),
            refereeReward: Number(refereeReward),
            coinsPerRupee: Number(coinsPerRupee),
            maxRedeemPercent: Number(maxRedeemPercent),
            active,
        });
    };
    const rate = Number(coinsPerRupee) || 1;
    return (_jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Coins, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Referral Program Settings" })] }), _jsx("button", { type: "button", onClick: () => setActive((a) => !a), className: cn("rounded-full px-3 py-1 text-xs font-semibold border transition-colors", active
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-gray-500/10 text-muted border-line"), children: active ? "Program Active" : "Program Paused" })] }), _jsx("p", { className: "text-sm text-muted", children: "A single program for the whole app. Rewards are paid in coins; the conversion rate sets what a coin is worth when customers redeem them at checkout." }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsxs("label", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-muted", children: "Referrer reward (coins)" }), _jsx(Input, { name: "referrerReward", type: "number", min: "0", value: referrerReward, onChange: (e) => setReferrerReward(e.target.value) })] }), _jsxs("label", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-muted", children: "New user reward (coins)" }), _jsx(Input, { name: "refereeReward", type: "number", min: "0", value: refereeReward, onChange: (e) => setRefereeReward(e.target.value) })] }), _jsxs("label", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-muted", children: "Conversion rate (coins per \u20B91)" }), _jsx(Input, { name: "coinsPerRupee", type: "number", min: "1", value: coinsPerRupee, onChange: (e) => setCoinsPerRupee(e.target.value) })] }), _jsxs("label", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-muted", children: "Max order covered by coins (%)" }), _jsx(Input, { name: "maxRedeemPercent", type: "number", min: "0", max: "100", value: maxRedeemPercent, onChange: (e) => setMaxRedeemPercent(e.target.value) })] })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("p", { className: "text-xs text-muted", children: ["e.g. \u20B91 = ", rate, " coin", rate === 1 ? "" : "s", " \u00B7 ", Number(referrerReward) || 0, " coins \u2248 \u20B9", Math.floor((Number(referrerReward) || 0) / rate), " for the referrer."] }), _jsxs(Button, { size: "sm", onClick: save, disabled: update.isPending, children: [_jsx(Save, { className: "size-4" }), " ", update.isPending ? "Saving…" : "Save settings"] })] })] }));
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
export function Referrals() {
    const { data: logs = [], isLoading } = useReferralLogs();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const filtered = logs.filter((log) => {
        const q = search.toLowerCase();
        const matchesSearch = log.referrerName.toLowerCase().includes(q) ||
            log.referrerPhone.includes(q) ||
            log.referrerCode.toLowerCase().includes(q) ||
            log.refereeName.toLowerCase().includes(q) ||
            log.refereePhone.includes(q);
        const matchesStatus = statusFilter === "all" || log.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    const subscribedCount = logs.filter((l) => l.status === "Subscribed").length;
    const cleansDoneCount = logs.filter((l) => l.status === "First Clean Done").length;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-2xl font-bold text-ink", children: "Referrals" }), _jsx("p", { className: "mt-1 text-sm text-muted", children: "Configure the referral program and track invitation logs & conversion milestones." })] }), _jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5", children: [_jsx(Sparkles, { className: "size-4 text-primary" }), _jsxs("span", { className: "text-sm font-semibold text-primary", children: [logs.length, " Total Logs"] })] })] }), _jsx(ReferralSettingsSection, {}), _jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [_jsxs(GlassCard, { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Users, { className: "size-6" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: logs.length }), _jsx("p", { className: "text-xs text-muted", children: "Total Invitations" })] })] }), _jsxs(GlassCard, { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex size-12 items-center justify-center rounded-2xl bg-green-500/10 text-green-600", children: _jsx(CheckCircle2, { className: "size-6" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: cleansDoneCount }), _jsx("p", { className: "text-xs text-muted", children: "First Clean Completed" })] })] }), _jsxs(GlassCard, { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600", children: _jsx(Award, { className: "size-6" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: subscribedCount }), _jsx("p", { className: "text-xs text-muted", children: "Active Subscribers" })] })] })] }), _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center", children: [_jsx("div", { className: "flex-1", children: _jsx(Input, { name: "referral-search", placeholder: "Search by name, phone or code\u2026", leading: _jsx(Search, { className: "size-4" }), value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-muted", children: "Status:" }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "h-12 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50", children: [_jsx("option", { value: "all", children: "All statuses" }), _jsx("option", { value: "Joined", children: "Signed Up" }), _jsx("option", { value: "First Clean Done", children: "First Clean Done" }), _jsx("option", { value: "Subscribed", children: "Subscribed" })] })] })] }), isLoading ? (_jsxs("div", { className: "flex items-center justify-center gap-2 py-12 text-muted", children: [_jsx(Loader2, { className: "size-5 animate-spin" }), " Loading referral logs\u2026"] })) : logs.length === 0 ? (_jsxs(GlassCard, { className: "flex flex-col items-center gap-3 py-12 text-center", children: [_jsx("div", { className: "flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Gift, { className: "size-8" }) }), _jsx("p", { className: "font-semibold text-ink", children: "No referral logs found" }), _jsx("p", { className: "text-sm text-muted", children: "Referrals will appear here once customers share their invite codes." })] })) : filtered.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-muted", children: "No referral logs match your search." })) : (_jsx(GlassCard, { className: "overflow-hidden p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse text-left text-sm", children: [_jsx("thead", { className: "border-b border-line bg-surface-muted/50 text-xs font-semibold uppercase tracking-wider text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-4", children: "Referrer (Invited By)" }), _jsx("th", { className: "px-6 py-4" }), _jsx("th", { className: "px-6 py-4", children: "Referee (Friend Joined)" }), _jsx("th", { className: "px-6 py-4", children: "Status" }), _jsx("th", { className: "px-6 py-4", children: "Joined Date" })] }) }), _jsx("tbody", { className: "divide-y divide-line", children: filtered.map((log) => (_jsxs("tr", { className: "transition-colors hover:bg-surface-muted/20", children: [_jsxs("td", { className: "whitespace-nowrap px-6 py-4", children: [_jsx("div", { className: "font-medium text-ink", children: log.referrerName }), _jsxs("div", { className: "flex items-center gap-3 mt-0.5 text-xs text-muted", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Phone, { className: "size-3" }), " ", log.referrerPhone] }), _jsx("span", { className: "rounded bg-primary/5 px-1.5 py-0.5 font-mono text-primary border border-primary/10", children: log.referrerCode })] })] }), _jsx("td", { className: "px-6 py-4 text-center", children: _jsx(ArrowRight, { className: "size-4 text-muted/60 inline" }) }), _jsxs("td", { className: "whitespace-nowrap px-6 py-4", children: [_jsx("div", { className: "font-medium text-ink", children: log.refereeName }), _jsxs("div", { className: "flex items-center gap-1 mt-0.5 text-xs text-muted", children: [_jsx(Phone, { className: "size-3" }), " ", log.refereePhone] })] }), _jsx("td", { className: "whitespace-nowrap px-6 py-4", children: _jsx("span", { className: cn("rounded-full px-2.5 py-1 text-xs font-medium border inline-block", log.status === "Subscribed" && "bg-blue-500/10 text-blue-600 border-blue-500/20", log.status === "First Clean Done" && "bg-green-500/10 text-green-600 border-green-500/20", log.status === "Joined" && "bg-gray-500/10 text-ink-soft border-line"), children: log.status === "Joined" ? "Signed Up" : log.status }) }), _jsx("td", { className: "whitespace-nowrap px-6 py-4 text-muted", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Calendar, { className: "size-3.5" }), formatDate(log.joinedAt)] }) })] }, log.id))) })] }) }) }))] }));
}
