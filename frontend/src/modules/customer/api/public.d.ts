export type PublicCity = {
    id: string;
    name: string;
    active: boolean;
};
export type PublicZone = {
    id: string;
    name: string;
};
export type LeadInput = {
    name: string;
    phone: string;
    email?: string;
    city: string;
    location: string;
    deviceToken?: string;
};
/** Fetch all active cities from admin-managed list. No auth required. */
export declare function usePublicCities(): import("@tanstack/react-query").UseQueryResult<NoInfer<PublicCity[]>, Error>;
/** Fetch active zones/societies for a given city. No auth required. */
export declare function usePublicZones(cityId: string | null): import("@tanstack/react-query").UseQueryResult<NoInfer<PublicZone[]>, Error>;
/** Submit a lead for an unserviced city. No auth required. */
export declare function useSubmitLead(): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    city: string;
}, Error, LeadInput, unknown>;
