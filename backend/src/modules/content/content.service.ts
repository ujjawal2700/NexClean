import { SiteContentModel } from "./content.model";
import { DEFAULT_CONTENT, type SiteContent } from "./content.defaults";

/** Get the site-content doc, seeding it from defaults on first access. */
export async function getContent() {
  const existing = await SiteContentModel.findOne();
  if (!existing) return SiteContentModel.create({ ...DEFAULT_CONTENT });

  // Backfill sections added after this doc was first seeded.
  let changed = false;
  if (!existing.get("landing")) {
    existing.set("landing", DEFAULT_CONTENT.landing);
    existing.markModified("landing");
    changed = true;
  }
  const pages = (existing.get("pages") ?? {}) as Record<string, unknown>;
  if (!pages.careers) {
    existing.set("pages", { ...pages, careers: DEFAULT_CONTENT.pages.careers });
    existing.markModified("pages");
    changed = true;
  }
  if (changed) await existing.save();
  return existing;
}

/** Replace any provided top-level sections (footer/pages/contact/help) and persist. */
export async function updateContent(patch: Partial<SiteContent>) {
  const doc = await getContent();
  for (const key of ["footer", "pages", "contact", "help", "landing"] as const) {
    if (patch[key] !== undefined) {
      doc.set(key, patch[key]);
      doc.markModified(key);
    }
  }
  await doc.save();
  return doc;
}
