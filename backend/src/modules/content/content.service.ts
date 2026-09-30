import { SiteContentModel } from "./content.model";
import { DEFAULT_CONTENT, type SiteContent } from "./content.defaults";
import { LEGAL_CONTENT_VERSION } from "../../shared/legalDocuments";

/** Get the site-content doc, seeding it from defaults on first access. */
export async function getContent() {
  const existing = await SiteContentModel.findOne();
  if (!existing) return SiteContentModel.create({ ...DEFAULT_CONTENT, legalContentVersion: LEGAL_CONTENT_VERSION });

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
  // One-time legal-copy migration. This intentionally replaces the earlier,
  // incomplete seed while preserving every non-legal CMS page and section.
  if (Number(existing.get("legalContentVersion") ?? 0) < LEGAL_CONTENT_VERSION) {
    const currentPages = (existing.get("pages") ?? {}) as SiteContent["pages"];
    existing.set("pages", {
      ...currentPages,
      privacy: DEFAULT_CONTENT.pages.privacy,
      terms: DEFAULT_CONTENT.pages.terms,
    });
    existing.set("legalContentVersion", LEGAL_CONTENT_VERSION);
    const footer = existing.get("footer") as SiteContent["footer"] | undefined;
    if (footer) {
      existing.set("footer", {
        ...footer,
        columns: footer.columns.map((column) => ({
          ...column,
          links: column.links.map((link) =>
            link.href === "/terms" ? { ...link, label: "Terms & Conditions" } : link,
          ),
        })),
      });
      existing.markModified("footer");
    }
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
