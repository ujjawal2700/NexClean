import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Gift, Users, ShoppingBag, Sparkles } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { useWallet } from "../api/queries";
const TX_META = {
    referral_welcome: { label: "Welcome bonus", icon: Sparkles, tone: "text-primary bg-primary/10" },
    referral_reward: { label: "Referral reward", icon: Users, tone: "text-amber-600 bg-amber-500/10" },
    redeem: { label: "Redeemed at checkout", icon: ShoppingBag, tone: "text-rose-600 bg-rose-500/10" },
};
function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function Wallet() {
    const navigate = useNavigate();
    const { data: wallet, isLoading } = useWallet();
    const transactions = wallet?.transactions ?? [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Wallet" })] }), _jsx(GlassCard, { className: "relative overflow-hidden bg-gradient-to-br from-amber-400/15 to-primary/5 border-amber-400/20", children: _jsxs("div", { className: "relative z-10 space-y-4", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700", children: [_jsx(Coins, { className: "size-3.5" }), " Coin Balance"] }), _jsxs("div", { children: [_jsxs("h2", { className: "font-display text-4xl font-extrabold text-ink", children: [(wallet?.coins ?? 0).toLocaleString("en-IN"), " ", _jsx("span", { className: "text-2xl text-amber-600", children: "coins" })] }), _jsxs("p", { className: "text-sm text-ink-soft mt-1", children: ["Worth ", formatMoney(wallet?.rupeeValue ?? 0), " \u00B7 use them for discounts when you book or subscribe."] })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => navigate("/app/profile/refer"), className: "rounded-2xl", children: [_jsx(Gift, { className: "size-4" }), " Earn more coins"] })] }) }), _jsxs("div", { className: "space-y-3 pt-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Coins, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Transaction History" })] }), isLoading ? (_jsx("p", { className: "py-8 text-center text-sm text-muted", children: "Loading your wallet\u2026" })) : transactions.length === 0 ? (_jsxs("div", { className: "text-center p-10 bg-surface border border-line border-dashed rounded-2xl", children: [_jsx(Coins, { className: "size-8 text-muted mx-auto mb-2" }), _jsx("p", { className: "text-sm text-ink-soft font-semibold", children: "No transactions yet" }), _jsx("p", { className: "text-xs text-muted max-w-xs mx-auto mt-1 leading-relaxed", children: "Refer friends to earn coins, then redeem them for discounts at checkout." })] })) : (_jsx("div", { className: "space-y-2", children: transactions.map((tx) => {
                            const meta = TX_META[tx.type];
                            const Icon = meta.icon;
                            const isCredit = tx.coins > 0;
                            return (_jsxs(GlassCard, { className: "flex items-center gap-3 p-4 bg-surface", children: [_jsx("div", { className: cn("flex size-10 items-center justify-center rounded-xl shrink-0", meta.tone), children: _jsx(Icon, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-semibold text-ink truncate", children: meta.label }), _jsx("p", { className: "text-xs text-muted truncate", children: tx.note || formatDate(tx.createdAt) })] }), _jsxs("div", { className: "text-right shrink-0", children: [_jsxs("p", { className: cn("text-sm font-bold", isCredit ? "text-emerald-600" : "text-rose-600"), children: [isCredit ? "+" : "", tx.coins.toLocaleString("en-IN")] }), _jsxs("p", { className: "text-[10px] text-muted", children: ["Bal ", tx.balanceAfter.toLocaleString("en-IN")] })] })] }, tx.id));
                        }) }))] })] }));
}
