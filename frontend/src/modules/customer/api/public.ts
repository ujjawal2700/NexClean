import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";

export type PublicCity = { id: string; name: string; active: boolean };
export type PublicZone = { id: string; name: string };

export type LeadInput = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  location: string;
  deviceToken?: string;
};

/** Fetch all active cities from admin-managed list. No auth required. */
export function usePublicCities() {
  return useQuery<PublicCity[]>({
    queryKey: ["public", "cities"],
    queryFn: () => apiFetch<PublicCity[]>("/catalog/cities"),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Fetch active zones/societies for a given city. No auth required. */
export function usePublicZones(cityId: string | null) {
  return useQuery<PublicZone[]>({
    queryKey: ["public", "zones", cityId],
    queryFn: () => apiFetch<PublicZone[]>(`/catalog/zones?cityId=${cityId}`),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Submit a lead for an unserviced city. No auth required. */
export function useSubmitLead() {
  return useMutation({
    mutationFn: (input: LeadInput) =>
      apiFetch<{ id: string; city: string }>("/leads", { method: "POST", body: input }),
  });
}
