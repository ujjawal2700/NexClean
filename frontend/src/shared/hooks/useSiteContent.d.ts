import type { SiteContent } from "@shared/types/content";
/**
 * Public site content for the landing site. Falls back to bundled defaults so
 * the page renders instantly; the admin-edited values replace them once loaded.
 */
export declare function useSiteContent(): SiteContent;
