import { PromoBanner, type PromoBannerDoc } from "./promoBanner.model";
import { ApiError } from "../../shared/utils/ApiError";

function mapBanner(b: PromoBannerDoc) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    ctaLabel: b.ctaLabel,
    ctaLink: b.ctaLink,
    sortOrder: b.sortOrder,
    active: b.active,
  };
}

export async function listPromoBanners() {
  const banners = await PromoBanner.find().sort({ sortOrder: 1, createdAt: -1 });
  return banners.map(mapBanner);
}

export async function listActivePromoBanners() {
  const banners = await PromoBanner.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 });
  return banners.map(mapBanner);
}

export async function createPromoBanner(input: {
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaLink?: string;
  sortOrder?: number;
}) {
  return mapBanner(await PromoBanner.create(input));
}

export async function updatePromoBanner(
  id: string,
  patch: {
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaLink?: string;
    sortOrder?: number;
    active?: boolean;
  },
) {
  const banner = await PromoBanner.findByIdAndUpdate(id, patch, { new: true });
  if (!banner) throw ApiError.notFound("Promotional banner not found");
  return mapBanner(banner);
}

export async function deletePromoBanner(id: string) {
  const banner = await PromoBanner.findByIdAndDelete(id);
  if (!banner) throw ApiError.notFound("Promotional banner not found");
}
