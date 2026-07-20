import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { DEFAULT_SITE_CONTENT } from "@shared/content/defaults";
/**
 * Public site content for the landing site. Falls back to bundled defaults so
 * the page renders instantly; the admin-edited values replace them once loaded.
 */
export function useSiteContent() {
    const { data } = useQuery({
        queryKey: ["site-content"],
        queryFn: () => apiFetch("/catalog/content"),
        staleTime: 5 * 60 * 1000,
    });
    return data ?? DEFAULT_SITE_CONTENT;
}
