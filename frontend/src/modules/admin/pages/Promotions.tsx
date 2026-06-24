import { useState } from "react";
import { Plus, Trash2, Percent, Share2, Image as ImageIcon } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import {
  useDiscountCodes,
  useCreateDiscountCode,
  useUpdateDiscountCode,
  useDeleteDiscountCode,
  useReferralCampaigns,
  useCreateReferralCampaign,
  useUpdateReferralCampaign,
  useDeleteReferralCampaign,
  usePromoBanners,
  useCreatePromoBanner,
  useUpdatePromoBanner,
  useDeletePromoBanner,
} from "../api/admin.api";
import type { DiscountType } from "../types";

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

  const submit = () => {
    if (!code.trim() || !value) return;
    create.mutate(
      {
        code: code.trim(),
        type,
        value: Number(value),
        minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
        validTill: validTill ? new Date(validTill).toISOString() : null,
      },
      {
        onSuccess: () => {
          setCode("");
          setValue("");
          setMinOrderValue("");
          setValidTill("");
        },
      },
    );
  };

  return (
    <GlassCard className="space-y-5">
      <div className="flex items-center gap-2">
        <Percent className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Discount Codes</p>
      </div>
      <p className="text-sm text-muted">Create promo codes customers can redeem at checkout for a percent or flat discount.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          name="code"
          placeholder="e.g. WELCOME20"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
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
      <Button size="sm" onClick={submit} disabled={create.isPending || !code.trim() || !value}>
        <Plus className="size-4" /> Add discount code
      </Button>

      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-3">
            <div className="min-w-0">
              <p className={`font-mono text-sm font-semibold ${c.active ? "text-ink" : "text-muted line-through"}`}>{c.code}</p>
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
      </div>
    </GlassCard>
  );
}

function ReferralCampaignsSection() {
  const { data: campaigns = [] } = useReferralCampaigns();
  const create = useCreateReferralCampaign();
  const update = useUpdateReferralCampaign();
  const remove = useDeleteReferralCampaign();

  const [name, setName] = useState("");
  const [referrerReward, setReferrerReward] = useState("");
  const [refereeReward, setRefereeReward] = useState("");

  const submit = () => {
    if (!name.trim() || !referrerReward || !refereeReward) return;
    create.mutate(
      { name: name.trim(), referrerReward: Number(referrerReward), refereeReward: Number(refereeReward) },
      {
        onSuccess: () => {
          setName("");
          setReferrerReward("");
          setRefereeReward("");
        },
      },
    );
  };

  return (
    <GlassCard className="space-y-5">
      <div className="flex items-center gap-2">
        <Share2 className="size-5 text-primary" />
        <p className="font-display text-lg font-semibold text-ink">Referral Campaigns</p>
      </div>
      <p className="text-sm text-muted">Reward existing customers and new sign-ups when they refer friends.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="referralName" placeholder="e.g. Refer & Earn" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          name="referrerReward"
          type="number"
          placeholder="Referrer reward (₹)"
          value={referrerReward}
          onChange={(e) => setReferrerReward(e.target.value)}
        />
        <Input
          name="refereeReward"
          type="number"
          placeholder="New customer reward (₹)"
          value={refereeReward}
          onChange={(e) => setRefereeReward(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={submit} disabled={create.isPending || !name.trim() || !referrerReward || !refereeReward}>
        <Plus className="size-4" /> Add referral campaign
      </Button>

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-3">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${c.active ? "text-ink" : "text-muted line-through"}`}>{c.name}</p>
              <p className="text-xs text-muted">
                Referrer gets {formatMoney(c.referrerReward)} · New customer gets {formatMoney(c.refereeReward)}
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
        {campaigns.length === 0 && <p className="text-sm text-muted">No referral campaigns yet. Add one above.</p>}
      </div>
    </GlassCard>
  );
}

function PromotionalBannersSection() {
  const { data: banners = [] } = usePromoBanners();
  const create = useCreatePromoBanner();
  const update = useUpdatePromoBanner();
  const remove = useDeletePromoBanner();

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaLink, setCtaLink] = useState("");

  const submit = () => {
    if (!title.trim() || !imageUrl.trim()) return;
    create.mutate(
      { title: title.trim(), imageUrl: imageUrl.trim(), ctaLabel: ctaLabel.trim(), ctaLink: ctaLink.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setImageUrl("");
          setCtaLabel("");
          setCtaLink("");
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
      <p className="text-sm text-muted">Manage the marketing banners shown on the customer app home screen.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="bannerTitle" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input name="bannerImage" placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <Input name="bannerCtaLabel" placeholder="Button label (optional)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        <Input name="bannerCtaLink" placeholder="Button link (optional)" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} />
      </div>
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
        <p className="mt-1 text-muted">Manage discount codes, referral campaigns, and promotional banners.</p>
      </div>

      <DiscountCodesSection />
      <ReferralCampaignsSection />
      <PromotionalBannersSection />
    </div>
  );
}
