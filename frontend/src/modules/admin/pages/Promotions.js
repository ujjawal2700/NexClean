import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { Plus, Trash2, Percent, Image as ImageIcon, Loader2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { ApiError } from "@shared/lib/api";
import { useDiscountCodes, useCreateDiscountCode, useUpdateDiscountCode, useDeleteDiscountCode, usePromoBanners, useCreatePromoBanner, useUpdatePromoBanner, useDeletePromoBanner, useUploadMedia, } from "../api/admin.api";
function DiscountCodesSection() {
    const { data: codes = [] } = useDiscountCodes();
    const create = useCreateDiscountCode();
    const update = useUpdateDiscountCode();
    const remove = useDeleteDiscountCode();
    const [code, setCode] = useState("");
    const [type, setType] = useState("percent");
    const [value, setValue] = useState("");
    const [minOrderValue, setMinOrderValue] = useState("");
    const [validTill, setValidTill] = useState("");
    const [error, setError] = useState("");
    const submit = () => {
        if (!code.trim() || !value)
            return;
        setError("");
        create.mutate({
            code: code.trim(),
            type,
            value: Number(value),
            minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
            validTill: validTill ? new Date(validTill).toISOString() : null,
        }, {
            onSuccess: () => {
                setCode("");
                setValue("");
                setMinOrderValue("");
                setValidTill("");
            },
            onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't create that discount code"),
        });
    };
    return (_jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Percent, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Discount Codes" })] }), _jsx("p", { className: "text-sm text-muted", children: "Create promo codes customers can redeem at checkout for a percent or flat discount." }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-5", children: [_jsx(Input, { name: "code", placeholder: "e.g. WELCOME20", value: code, onChange: (e) => setCode(e.target.value.toUpperCase()), error: error }), _jsxs("select", { value: type, onChange: (e) => setType(e.target.value), className: "h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50", children: [_jsx("option", { value: "percent", children: "% off" }), _jsx("option", { value: "flat", children: "\u20B9 flat off" })] }), _jsx(Input, { name: "value", type: "number", placeholder: type === "percent" ? "e.g. 20" : "e.g. 100", value: value, onChange: (e) => setValue(e.target.value) }), _jsx(Input, { name: "minOrderValue", type: "number", placeholder: "Min order (optional)", value: minOrderValue, onChange: (e) => setMinOrderValue(e.target.value) }), _jsx(Input, { name: "validTill", type: "date", value: validTill, onChange: (e) => setValidTill(e.target.value) })] }), _jsxs(Button, { size: "sm", onClick: submit, disabled: create.isPending || !code.trim() || !value, children: [_jsx(Plus, { className: "size-4" }), " Add discount code"] }), _jsxs("div", { className: "space-y-2", children: [codes.map((c) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: `font-mono text-sm font-semibold ${c.active ? "text-ink" : "text-muted line-through"}`, children: c.code }), _jsxs("p", { className: "text-xs text-muted", children: [c.type === "percent" ? `${c.value}% off` : `${formatMoney(c.value)} off`, c.minOrderValue ? ` · min order ${formatMoney(c.minOrderValue)}` : "", c.validTill ? ` · valid till ${new Date(c.validTill).toLocaleDateString("en-IN")}` : "", ` · used ${c.usageCount}×`] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: c.id, active: !c.active }), children: c.active ? "Active" : "Inactive" }), _jsx(Button, { variant: "ghost", size: "sm", disabled: remove.isPending, onClick: () => remove.mutate(c.id), children: _jsx(Trash2, { className: "size-4" }) })] })] }, c.id))), codes.length === 0 && _jsx("p", { className: "text-sm text-muted", children: "No discount codes yet. Add one above." })] })] }));
}
function PromotionalBannersSection() {
    const { data: banners = [] } = usePromoBanners();
    const create = useCreatePromoBanner();
    const update = useUpdatePromoBanner();
    const remove = useDeletePromoBanner();
    const uploadMedia = useUploadMedia();
    const [title, setTitle] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [ctaLabel, setCtaLabel] = useState("");
    const [ctaLink, setCtaLink] = useState("");
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef(null);
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024) {
            setUploadError("Image must be smaller than 5MB");
            return;
        }
        setUploadError("");
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result;
            uploadMedia.mutate(base64, {
                onSuccess: (data) => {
                    setImageUrl(data.imageUrl);
                    if (fileInputRef.current)
                        fileInputRef.current.value = "";
                },
                onError: (err) => {
                    setUploadError(err instanceof Error ? err.message : "Upload failed");
                },
            });
        };
        reader.readAsDataURL(file);
    };
    const submit = () => {
        if (!title.trim() || !imageUrl.trim())
            return;
        create.mutate({ title: title.trim(), imageUrl: imageUrl.trim(), ctaLabel: ctaLabel.trim(), ctaLink: ctaLink.trim() }, {
            onSuccess: () => {
                setTitle("");
                setImageUrl("");
                setCtaLabel("");
                setCtaLink("");
            },
        });
    };
    return (_jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ImageIcon, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Promotional Banners" })] }), _jsxs("p", { className: "text-sm text-muted", children: ["Manage marketing banners. An Image URL or file upload is ", _jsx("strong", { className: "text-red-500 font-semibold", children: "compulsory" }), ". Banners are uploaded directly to Cloudinary."] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Input, { name: "bannerTitle", placeholder: "Title", value: title, onChange: (e) => setTitle(e.target.value) }), _jsx(Input, { name: "bannerImage", placeholder: "Image URL (populated automatically on file upload)", value: imageUrl, onChange: (e) => setImageUrl(e.target.value) }), _jsx(Input, { name: "bannerCtaLabel", placeholder: "Button label (optional)", value: ctaLabel, onChange: (e) => setCtaLabel(e.target.value) }), _jsx(Input, { name: "bannerCtaLink", placeholder: "Button link (optional)", value: ctaLink, onChange: (e) => setCtaLink(e.target.value) })] }), _jsxs("div", { className: "rounded-2xl border border-dashed border-line bg-surface/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-4", children: [_jsxs("div", { className: "space-y-0.5 text-center sm:text-left", children: [_jsx("p", { className: "text-sm font-medium text-ink", children: "Upload image file" }), _jsx("p", { className: "text-xs text-muted", children: "Supports PNG, JPG up to 5MB. Saves directly to Cloudinary." })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileChange, className: "hidden" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => fileInputRef.current?.click(), disabled: uploadMedia.isPending, children: uploadMedia.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Uploading to Cloudinary\u2026"] })) : ("Choose Image File") })] })] }), uploadError && _jsx("p", { className: "text-xs text-red-500", children: uploadError }), _jsxs(Button, { size: "sm", onClick: submit, disabled: create.isPending || !title.trim() || !imageUrl.trim(), children: [_jsx(Plus, { className: "size-4" }), " Add banner"] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [banners.map((b) => (_jsxs("div", { className: "overflow-hidden rounded-2xl border border-line bg-surface/60", children: [_jsx("div", { className: "aspect-[16/7] w-full bg-surface-muted", children: _jsx("img", { src: b.imageUrl, alt: b.title, className: "size-full object-cover" }) }), _jsxs("div", { className: "flex items-center justify-between gap-3 p-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: `truncate text-sm font-semibold ${b.active ? "text-ink" : "text-muted line-through"}`, children: b.title }), b.ctaLabel && _jsx("p", { className: "truncate text-xs text-muted", children: b.ctaLabel })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: b.id, active: !b.active }), children: b.active ? "Active" : "Inactive" }), _jsx(Button, { variant: "ghost", size: "sm", disabled: remove.isPending, onClick: () => remove.mutate(b.id), children: _jsx(Trash2, { className: "size-4" }) })] })] })] }, b.id))), banners.length === 0 && _jsx("p", { className: "text-sm text-muted sm:col-span-2", children: "No banners yet. Add one above." })] })] }));
}
export function Promotions() {
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Coupon & Promotions" }), _jsx("p", { className: "mt-1 text-muted", children: "Manage discount codes and promotional banners." })] }), _jsx(DiscountCodesSection, {}), _jsx(PromotionalBannersSection, {})] }));
}
