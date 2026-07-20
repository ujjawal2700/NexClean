import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Copy, Check, Users, Share2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { useReferralSummary } from "../api/queries";
export function ReferEarn() {
    const navigate = useNavigate();
    const { data: referrals } = useReferralSummary();
    const [copied, setCopied] = useState(false);
    const copyReferralCode = () => {
        if (!referrals?.referralCode)
            return;
        navigator.clipboard.writeText(referrals.referralCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    const shareCode = () => {
        if (!referrals?.referralCode)
            return;
        if (navigator.share) {
            navigator.share({
                title: "Join NexClean!",
                text: `Get a sparkling clean car with doorstep wash from NexClean! Use my referral code: ${referrals.referralCode} to sign up.`,
                url: window.location.origin,
            }).catch(console.error);
        }
        else {
            copyReferralCode();
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Refer & Earn" })] }), _jsx(GlassCard, { className: "relative overflow-hidden bg-gradient-to-br from-primary/10 to-indigo-500/5 border-primary/20", children: _jsxs("div", { className: "relative z-10 space-y-3", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary", children: [_jsx(Gift, { className: "size-3.5" }), " Referral Program"] }), _jsx("h2", { className: "font-display text-2xl font-bold text-ink", children: "Share the Love, Get Rewarded" }), _jsxs("p", { className: "text-sm text-ink-soft max-w-xl leading-relaxed", children: ["Invite your friends to NexClean! You'll earn ", _jsxs("span", { className: "font-bold text-primary", children: [referrals?.rewardAmount ?? 100, " coins"] }), " for every friend who signs up and completes their first service. Coins land in your wallet \u2014 redeem them for discounts at checkout!"] })] }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs(GlassCard, { className: "col-span-1 md:col-span-2 flex flex-col justify-between p-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Your Referral Code" }), _jsx("p", { className: "text-xs text-muted mt-0.5", children: "Friends enter this code during signup" })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsxs("div", { className: "flex-1 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3", children: [_jsx("span", { className: "font-display text-xl font-bold tracking-[0.08em] text-primary", children: referrals?.referralCode ?? "—" }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: copyReferralCode, disabled: !referrals?.referralCode, className: "h-8", children: [copied ? _jsx(Check, { className: "size-4 text-emerald-500" }) : _jsx(Copy, { className: "size-4" }), copied ? "Copied" : "Copy"] })] }), _jsx(Button, { variant: "outline", onClick: shareCode, className: "rounded-2xl", "aria-label": "Share", children: _jsx(Share2, { className: "size-4" }) })] })] }), _jsxs(GlassCard, { className: "flex flex-col justify-between p-5 bg-surface", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Coin Balance" }), _jsx("p", { className: "text-xs text-muted mt-0.5", children: "Redeemable at checkout" })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("h3", { className: "font-display text-3xl font-extrabold text-amber-500", children: [(referrals?.coins ?? 0).toLocaleString("en-IN"), " ", _jsx("span", { className: "text-lg", children: "coins" })] }), _jsxs("p", { className: "text-xs text-muted mt-1", children: ["\u2248 ", formatMoney(Math.floor((referrals?.coins ?? 0) / (referrals?.coinsPerRupee || 1))), " in value"] })] })] })] }), _jsxs("div", { className: "space-y-4 pt-2", children: [_jsxs("div", { className: "flex items-center gap-2 pb-1", children: [_jsx(Users, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Referred Friends' Journey" })] }), referrals?.referredUsers && referrals.referredUsers.length > 0 ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: referrals.referredUsers.map((user) => {
                            const isJoined = true; // Friend joined because they are in the list
                            const isWashCompleted = user.status === "First Clean Done" || user.status === "Subscribed";
                            const isRewarded = user.status === "First Clean Done" || user.status === "Subscribed";
                            return (_jsxs(GlassCard, { className: "p-5 border border-line bg-surface flex flex-col justify-between space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-display font-semibold text-ink text-base leading-snug", children: user.name }), _jsxs("p", { className: "text-[11px] text-muted mt-0.5", children: ["Joined on ", new Date(user.joinedAt).toLocaleDateString("en-IN", {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric",
                                                            })] })] }), _jsx("span", { className: cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", isRewarded
                                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                    : "bg-blue-100 text-blue-800 border border-blue-200"), children: user.status === "Subscribed" ? "Subscribed" : isRewarded ? "Rewarded" : "Signed Up" })] }), _jsxs("div", { className: "relative pt-2", children: [_jsx("div", { className: "absolute top-[18px] left-[15%] right-[15%] h-1 bg-line rounded-full z-0", children: _jsx("div", { className: "h-full bg-primary rounded-full transition-all duration-700", style: { width: isRewarded ? "100%" : "0%" } }) }), _jsxs("div", { className: "grid grid-cols-3 gap-2 relative z-10", children: [_jsxs("div", { className: "flex flex-col items-center text-center", children: [_jsx("div", { className: cn("size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300", isJoined ? "bg-primary text-white" : "bg-line text-muted"), children: "\u2713" }), _jsx("span", { className: "mt-2 text-[11px] font-bold text-ink leading-tight", children: "Signed Up" }), _jsx("span", { className: "text-[9px] text-muted", children: "Success" })] }), _jsxs("div", { className: "flex flex-col items-center text-center", children: [_jsx("div", { className: cn("size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300", isWashCompleted
                                                                    ? "bg-primary text-white"
                                                                    : "bg-surface border border-line text-muted"), children: isWashCompleted ? "✓" : "2" }), _jsx("span", { className: "mt-2 text-[11px] font-bold text-ink leading-tight", children: "First Wash" }), _jsx("span", { className: "text-[9px] text-muted leading-tight", children: isWashCompleted ? "Completed" : "Awaiting wash" })] }), _jsxs("div", { className: "flex flex-col items-center text-center", children: [_jsx("div", { className: cn("size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300", isRewarded
                                                                    ? "bg-emerald-500 text-white"
                                                                    : "bg-surface border border-line text-muted"), children: isRewarded ? "₹" : "3" }), _jsx("span", { className: "mt-2 text-[11px] font-bold text-ink leading-tight", children: "Reward" }), _jsx("span", { className: "text-[9px] font-medium text-amber-600", children: isRewarded ? `+${referrals.rewardAmount || 100} coins` : "Pending" })] })] })] })] }, user.id));
                        }) })) : (_jsxs("div", { className: "text-center p-10 bg-surface border border-line border-dashed rounded-2xl", children: [_jsx(Users, { className: "size-8 text-muted mx-auto mb-2" }), _jsx("p", { className: "text-sm text-ink-soft font-semibold", children: "No referrals yet" }), _jsx("p", { className: "text-xs text-muted max-w-xs mx-auto mt-1 leading-relaxed", children: "When friends sign up using your referral code, they'll appear here along with their step-by-step reward journey!" })] }))] })] }));
}
