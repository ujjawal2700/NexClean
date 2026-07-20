import type { SiteContent } from "@shared/types/content";
/**
 * Client-side fallback for site content — mirrors the backend defaults so the
 * landing site renders instantly before the API responds. Once `/catalog/content`
 * loads, the live (admin-edited) values take over.
 */
export declare const DEFAULT_SITE_CONTENT: SiteContent;
