import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
/** Fetch all active cities from admin-managed list. No auth required. */
export function usePublicCities() {
    return useQuery({
        queryKey: ["public", "cities"],
        queryFn: () => apiFetch("/catalog/cities"),
        staleTime: 5 * 60 * 1000, // 5 min
    });
}
/** Fetch active zones/societies for a given city. No auth required. */
export function usePublicZones(cityId) {
    return useQuery({
        queryKey: ["public", "zones", cityId],
        queryFn: () => apiFetch(`/catalog/zones?cityId=${cityId}`),
        enabled: !!cityId,
        staleTime: 5 * 60 * 1000,
    });
}
/** Submit a lead for an unserviced city. No auth required. */
export function useSubmitLead() {
    return useMutation({
        mutationFn: (input) => apiFetch("/leads", { method: "POST", body: input }),
    });
}
