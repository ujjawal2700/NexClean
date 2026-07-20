import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { IndianRupee, RotateCcw, Wallet, CheckCircle2, Undo2, Search } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney, formatDate } from "@shared/lib/format";
import { usePayments, usePaymentStats, useRefundPayment, useSettlePayment } from "../api/admin.api";
import { StatCard } from "../components/StatCard";
import { PAYMENT_STATUS_STYLE, PAYMENT_STATUS_LABEL, SETTLEMENT_STATUS_STYLE } from "../lib/status";
const isWithinDays = (dateStr, days) => {
    const date = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return date.getTime() >= cutoff.getTime();
};
const isToday = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    return (date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear());
};
const isYesterday = (dateStr) => {
    const date = new Date(dateStr);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear());
};
export function Payments() {
    const { data: payments = [] } = usePayments();
    const { data: stats } = usePaymentStats();
    const refund = useRefundPayment();
    const settle = useSettlePayment();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [agentFilter, setAgentFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");
    const [sortBy, setSortBy] = useState("date-desc");
    // Distinct agent names for the select filter dropdown
    const agentsList = Array.from(new Set(payments
        .map((p) => p.agentName)
        .filter((name) => typeof name === "string" && name.trim().length > 0))).sort();
    const q = query.toLowerCase();
    const filteredList = payments.filter((p) => {
        // 1. Search Query Match
        const matchesSearch = !q ||
            p.customerName.toLowerCase().includes(q) ||
            (p.agentName && p.agentName.toLowerCase().includes(q)) ||
            p.orderId.toLowerCase().includes(q) ||
            p.society.toLowerCase().includes(q) ||
            p.amount.toString().includes(q);
        // 2. Status Match
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        // 3. Agent Match
        const matchesAgent = agentFilter === "all" || p.agentName === agentFilter;
        // 4. Date Range Match
        let matchesDate = true;
        if (dateFilter !== "all") {
            if (dateFilter === "today") {
                matchesDate = isToday(p.createdAt);
            }
            else if (dateFilter === "yesterday") {
                matchesDate = isYesterday(p.createdAt);
            }
            else if (dateFilter === "7days") {
                matchesDate = isWithinDays(p.createdAt, 7);
            }
            else if (dateFilter === "30days") {
                matchesDate = isWithinDays(p.createdAt, 30);
            }
        }
        return matchesSearch && matchesStatus && matchesAgent && matchesDate;
    });
    // Sorting
    const list = [...filteredList].sort((a, b) => {
        if (sortBy === "date-desc") {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "date-asc") {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "amount-desc") {
            return b.amount - a.amount;
        }
        if (sortBy === "amount-asc") {
            return a.amount - b.amount;
        }
        return 0;
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: _jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Payments" }), _jsxs("p", { className: "mt-1 text-muted", children: [payments.length, " transactions \u00B7 refunds and agent settlement."] })] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-4 lg:grid-cols-4", children: [_jsx(StatCard, { icon: IndianRupee, label: "Total collected", value: formatMoney(stats?.totalCollected ?? 0) }), _jsx(StatCard, { icon: Undo2, label: "Total refunded", value: formatMoney(stats?.totalRefunded ?? 0) }), _jsx(StatCard, { icon: Wallet, label: "Pending settlement", value: formatMoney(stats?.pendingSettlement ?? 0) }), _jsx(StatCard, { icon: CheckCircle2, label: "Settled to agents", value: formatMoney(stats?.settledAmount ?? 0) })] }), _jsxs(GlassCard, { className: "grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 bg-surface/50 border-line/50 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[11px] font-semibold text-muted uppercase tracking-wider", children: "Search" }), _jsx(Input, { name: "search", placeholder: "Order, customer, agent, amount\u2026", leading: _jsx(Search, { className: "size-4" }), value: query, onChange: (e) => setQuery(e.target.value) })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[11px] font-semibold text-muted uppercase tracking-wider", children: "Status" }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer", children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: "paid", children: "Paid" }), _jsx("option", { value: "refunded", children: "Refunded" }), _jsx("option", { value: "mock", children: "Mock" })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[11px] font-semibold text-muted uppercase tracking-wider", children: "Agent" }), _jsxs("select", { value: agentFilter, onChange: (e) => setAgentFilter(e.target.value), className: "h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer", children: [_jsx("option", { value: "all", children: "All Agents" }), agentsList.map((name) => (_jsx("option", { value: name, children: name }, name)))] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[11px] font-semibold text-muted uppercase tracking-wider", children: "Date Range" }), _jsxs("select", { value: dateFilter, onChange: (e) => setDateFilter(e.target.value), className: "h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer", children: [_jsx("option", { value: "all", children: "All Time" }), _jsx("option", { value: "today", children: "Today" }), _jsx("option", { value: "yesterday", children: "Yesterday" }), _jsx("option", { value: "7days", children: "Last 7 Days" }), _jsx("option", { value: "30days", children: "Last 30 Days" })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4 xl:col-span-1", children: [_jsx("label", { className: "text-[11px] font-semibold text-muted uppercase tracking-wider", children: "Sort By" }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "h-10 rounded-xl border border-line bg-surface/80 px-3 text-sm text-ink outline-none focus:border-primary/50 transition-colors cursor-pointer", children: [_jsx("option", { value: "date-desc", children: "Date: Newest First" }), _jsx("option", { value: "date-asc", children: "Date: Oldest First" }), _jsx("option", { value: "amount-desc", children: "Amount: High to Low" }), _jsx("option", { value: "amount-asc", children: "Amount: Low to High" })] })] })] }), _jsx(GlassCard, { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[920px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wide text-muted", children: [_jsx("th", { className: "px-2 py-2 font-medium", children: "Order" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Customer" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Agent" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Date" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Status" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Settlement" }), _jsx("th", { className: "px-2 py-2 text-right font-medium", children: "Amount" }), _jsx("th", { className: "px-2 py-2" })] }) }), _jsxs("tbody", { children: [list.map((p) => (_jsxs("tr", { className: "border-t border-line/70", children: [_jsxs("td", { className: "px-2 py-3", children: [_jsx("p", { className: "font-medium text-ink", children: p.orderId }), _jsx("p", { className: "text-xs text-muted", children: p.society || "—" })] }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: p.customerName }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: p.agentName ?? "—" }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: formatDate(p.createdAt) }), _jsxs("td", { className: "px-2 py-3", children: [_jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", PAYMENT_STATUS_STYLE[p.status]), children: PAYMENT_STATUS_LABEL[p.status] }), p.status === "refunded" && (_jsxs("p", { className: "mt-1 text-xs text-muted", children: [formatMoney(p.refundAmount), " refunded"] }))] }), _jsx("td", { className: "px-2 py-3", children: p.status === "paid" ? (_jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", SETTLEMENT_STATUS_STYLE[p.settlementStatus]), children: p.settlementStatus })) : (_jsx("span", { className: "text-xs text-muted", children: "\u2014" })) }), _jsx("td", { className: "px-2 py-3 text-right font-medium text-ink", children: formatMoney(p.amount) }), _jsxs("td", { className: "px-2 py-3 text-right", children: [p.status === "paid" && (_jsxs("div", { className: "flex justify-end gap-1.5", children: [p.settlementStatus === "pending" && (_jsxs(Button, { variant: "ghost", size: "sm", disabled: settle.isPending, onClick: () => settle.mutate(p.id), children: [_jsx(Wallet, { className: "size-4" }), " Settle"] })), _jsxs(Button, { variant: "ghost", size: "sm", disabled: refund.isPending, onClick: () => refund.mutate({ id: p.id }), children: [_jsx(RotateCcw, { className: "size-4" }), " Refund"] })] })), p.status !== "paid" && _jsx("span", { className: "text-xs text-muted", children: "\u2014" })] })] }, p.id))), list.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-2 py-12 text-center text-muted", children: "No payments match your search." }) }))] })] }) })] }));
}
