export type PlaceCoords = {
    lat: number;
    lng: number;
};
type AutocompleteOptions = {
    /** Input element ref to attach Autocomplete to */
    inputRef: React.RefObject<HTMLInputElement | null>;
    /** Google Places types filter, e.g. ['(cities)'] or ['sublocality', 'neighborhood'] */
    types?: string[];
    /** Restrict results to a specific country code, e.g. 'in' for India */
    componentRestrictions?: {
        country: string;
    };
    /** Called with the place name, id, and (when available) geo coordinates */
    onSelect: (placeName: string, placeId: string, coords?: PlaceCoords) => void;
    /** Optional city name to restrict suggestions to this specific city's boundaries */
    cityName?: string;
};
/**
 * Attaches a Google Maps Places Autocomplete widget to the given input element.
 * Requires `window.google.maps.places` to be available.
 */
export declare function usePlacesAutocomplete({ inputRef, types, componentRestrictions, onSelect, cityName, }: AutocompleteOptions): void;
export {};
