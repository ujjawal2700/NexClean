import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Percent, Image as ImageIcon, Loader2, Clock, FileSpreadsheet } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { formatMoney, formatDate } from "@shared/lib/format";
import { exportRowsToExcel } from "@shared/lib/exportExcel";
import { ApiError } from "@shared/lib/api";
import { usePagination } from "@shared/lib/usePagination";
import {
  useDiscountCodes,
  useCreateDiscountCode,
  useUpdateDiscountCode,
  useDeleteDiscountCode,
  usePromoBanners,
  useCreatePromoBanner,
  useUpdatePromoBanner,
  useDeletePromoBanner,
  useUploadMedia,
} from "../api/admin.api";
import { ExportDateRangeModal } from "../components/ExportDateRangeModal";

import { BANNER_TYPES, type BannerType, type DiscountType } from "../types";

/** Admin-facing copy for each banner type, plus the badge tint used in the list. */
const BANNER_TYPE_META: Record<BannerType, { label: string; badge: string }> = {
  promotional: { label: "Promotional", badge: "bg-primary/10 text-primary" },
  discount: { label: "Discount", badge: "bg-emerald-500/10 text-emerald-600" },
  "off-peak-hours": { label: "Off-peak hours", badge: "bg-amber-500/10 text-amber-600" },
  announcement: { label: "Announcement", badge: "bg-sky-500/10 text-sky-600" },
};

function DiscountCodesSection() {
  const { data: codes = [] } = useDiscountCodes();
  const create = useCreateDiscountCode();
  const update = useUpdateDiscountCode();
  const remove = useDeleteDiscountCode();

  const [code, setCode] = useState("");
  const [type, setType] = useState<DiscountType>("percent");
  const [value, setValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [validTill, setValidTill] = useState("");
  const [offPeakOnly, setOffPeakOnly] = useState(false);
  const [error, setError] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);

  const paginated = usePagination(codes, 5);

  const exportExcel = (range: { from: Date | null; to: Date | null }) => {
    const rows = codes.filter((c) => {
      const created = new Date(c.createdAt);
      if (range.from && created < range.from) return false;
      if (range.to && created > range.to) return false;
      return true;
    });
    exportRowsToExcel(
      rows.map((c) => ({
        Code: c.code,
        Type: c.type === "percent" ? "% off" : "₹ flat off",
        Value: c.value,
        "Min Order (₹)": c.minOrderValue,
        "Max Discount (₹)": c.maxDiscount ?? "",
        "Usage Limit": c.usageLimit ?? "",
        "Used Count": c.usageCount,
        "Valid Till": c.validTill ? formatDate(c.validTill) : "",
        Active: c.active ? "Yes" : "No",
        "Off-Peak Only": c.offPeakOnly ? "Yes" : "No",
        Created: formatDate(c.createdAt),
      })),
      `nexclean-discount-codes-${new Date().toISOString().slice(0, 10)}`,
      "Discount Codes",
    );
  };

  const submit = () => {
    if (!code.trim() || !value) return;
    setError("");
    create.mutate(
      {
        code: code.trim(),
        type,
        value: Number(value),
        minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
        validTill: validTill ? new Date(validTill).toISOString() : null,
        offPeakOnly,
      },
      {
        onSuccess: () => {
          setCode("");
          setValue("");
          setMinOrderValue("");
          setValidTill("");
          setOffPeakOnly(false);
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't create that discount code"),
      },
    );
  };

  return (
    <GlassCard className="space-y-5">
      {showExportModal && (
        <ExportDateRangeModal
          title="Export Discount Codes"
          description="Choose a created-date range to export, or leave blank to export every discount code."
          onExport={exportExcel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Percent className="size-5 text-primary" />
          <p className="font-display text-lg font-semibold text-ink">Discount Codes</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} disabled={codes.length === 0}>
          <FileSpreadsheet className="size-4" /> Export Excel
        </Button>
      </div>
      <p className="text-sm text-muted">Create promo codes customers can redeem at checkout for a percent or flat discount.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          name="code"
          placeholder="e.g. WELCOME20"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          error={error}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DiscountType)}
          className="h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
        >
          <option value="percent">% off</option>
          <option value="flat">₹ flat off</option>
        </select>
        <Input
          name="value"
          type="number"
          placeholder={type === "percent" ? "e.g. 20" : "e.g. 100"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Input
          name="minOrderValue"
          type="number"
          placeholder="Min order (optional)"
          value={minOrderValue}
          onChange={(e) => setMinOrderValue(e.target.value)}
        />
        <Input name="validTill" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3">
        <input
          type="checkbox"
          checked={offPeakOnly}
          onChange={(e) => setOffPeakOnly(e.target.checked)}
          className="mt-0.5 size-4 accent-[color:var(--color-primary,#4F7CFF)]"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Clock className="size-3.5 text-primary" /> Off-peak hours only
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Applies only when the booking's time slot falls inside a window set on the{" "}
            <Link to="/admin/off-peak-hours" className="text-primary hover:underline">
              Off-Peak Hours
            </Link>{" "}
            page.
          </span>
        </span>
      </label>

      <Button size="sm" onClick={submit} disabled={create.isPending || !code.trim() || !value}>
        <Plus className="size-4" /> Add discount code
      </Button>

      <div className="space-y-2">
        {paginated.pageItems.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-3">
            <div className="min-w-0">
              <p className={`flex flex-wrap items-center gap-2 font-mono text-sm font-semibold ${c.active ? "text-ink" : "text-muted line-through"}`}>
                {c.code}
                {c.offPeakOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-sans text-[10px] font-medium text-amber-600">
                    <Clock className="size-3" /> Off-peak only
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {c.type === "percent" ? `${c.value}% off` : `${formatMoney(c.value)} off`}
                {c.minOrderValue ? ` · min order ${formatMoney(c.minOrderValue)}` : ""}
                {c.validTill ? ` · valid till ${new Date(c.validTill).toLocaleDateString("en-IN")}` : ""}
                {` · used ${c.usageCount}×`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: c.id, active: !c.active })}
              >
                {c.active ? "Active" : "Inactive"}
              </Button>
              <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(c.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="text-sm text-muted">No discount codes yet. Add one above.</p>}
        <Pagination
          page={paginated.page}
          totalPages={paginated.totalPages}
          onPageChange={paginated.setPage}
        />
      </div>
    </GlassCard>
  );
}

function PromotionalBannersSection() {
  const { data: banners = [] } = usePromoBanners();
  const create = useCreatePromoBanner();
  const update = useUpdatePromoBanner();
  const remove = useDeletePromoBanner();
  const uploadMedia = useUploadMedia();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaLink, setCtaLink] = useState("");
  const [bannerType, setBannerType] = useState<BannerType>("promotional");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be smaller than 5MB");
      return;
    }

    setUploadError("");
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      uploadMedia.mutate(base64, {
        onSuccess: (data) => {
          setImageUrl(data.imageUrl);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (err) => {
          setUploadError(err instanceof Error ? err.message : "Upload failed");
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!title.trim() || !imageUrl.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaLink: ctaLink.trim(),
        type: bannerType,
      },
      {
        onSuccess: () => {
          setTitle("");
          setSubtitle("");
          setImageUrl("");
          setCtaLabel("");
          setCtaLink("");
          setBannerType("promotional");
        },
      },
    );
  };

  return (
    <GlassCard className="space-y-5">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Promotional Banners</p>
      </div>
      <p className="text-sm text-muted">
        Manage marketing banners. An Image URL or file upload is <strong className="text-red-500 font-semibold">compulsory</strong>. Banners are uploaded directly to Cloudinary.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="bannerTitle" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          name="bannerImage"
          placeholder="Image URL (populated automatically on file upload)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <Input
          name="bannerSubtitle"
          placeholder="Subtitle (optional)"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
        <select
          value={bannerType}
          onChange={(e) => setBannerType(e.target.value as BannerType)}
          aria-label="Banner type"
          className="h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50"
        >
          {BANNER_TYPES.map((t) => (
            <option key={t} value={t}>
              {BANNER_TYPE_META[t].label}
            </option>
          ))}
        </select>
        <Input name="bannerCtaLabel" placeholder="Button label (optional)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        <Input name="bannerCtaLink" placeholder="Button link (optional)" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} />
      </div>

      {/* Media Upload Area */}
      <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-0.5 text-center sm:text-left">
          <p className="text-sm font-medium text-ink">Upload image file</p>
          <p className="text-xs text-muted">Supports PNG, JPG up to 5MB. Saves directly to Cloudinary.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMedia.isPending}
          >
            {uploadMedia.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading to Cloudinary…
              </>
            ) : (
              "Choose Image File"
            )}
          </Button>
        </div>
      </div>

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

      <Button size="sm" onClick={submit} disabled={create.isPending || !title.trim() || !imageUrl.trim()}>
        <Plus className="size-4" /> Add banner
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        {banners.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl border border-line bg-surface/60">
            <div className="aspect-[16/7] w-full bg-surface-muted">
              <img src={b.imageUrl} alt={b.title} className="size-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${b.active ? "text-ink" : "text-muted line-through"}`}>{b.title}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    BANNER_TYPE_META[b.type]?.badge ?? BANNER_TYPE_META.promotional.badge
                  }`}
                >
                  {BANNER_TYPE_META[b.type]?.label ?? BANNER_TYPE_META.promotional.label}
                </span>
                {b.ctaLabel && <p className="truncate text-xs text-muted">{b.ctaLabel}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: b.id, active: !b.active })}
                >
                  {b.active ? "Active" : "Inactive"}
                </Button>
                <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(b.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="text-sm text-muted sm:col-span-2">No banners yet. Add one above.</p>}
      </div>
    </GlassCard>
  );
}


export function Promotions() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Coupon & Promotions</h1>
        <p className="mt-1 text-muted">Manage discount codes and promotional banners.</p>
      </div>

      <DiscountCodesSection />
      <PromotionalBannersSection />
    </div>
  );
}
