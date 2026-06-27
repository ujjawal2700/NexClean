import { useEffect, useRef, useCallback } from "react";

type AutocompleteOptions = {
  /** Input element ref to attach Autocomplete to */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Google Places types filter, e.g. ['(cities)'] or ['sublocality', 'neighborhood'] */
  types?: string[];
  /** Restrict results to a specific country code, e.g. 'in' for India */
  componentRestrictions?: { country: string };
  /** Called with the place name when the user picks a suggestion */
  onSelect: (placeName: string, placeId: string) => void;
  /** Optional city name to restrict suggestions to this specific city's boundaries */
  cityName?: string;
};

/**
 * Attaches a Google Maps Places Autocomplete widget to the given input element.
 * Requires `window.google.maps.places` to be available.
 */
export function usePlacesAutocomplete({
  inputRef,
  types = [],
  componentRestrictions = { country: "in" },
  onSelect,
  cityName,
}: AutocompleteOptions) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const init = useCallback(() => {
    const input = inputRef.current;
    if (!input || autocompleteRef.current) return;
    if (typeof window === "undefined" || !window.google?.maps?.places) return;

    const ac = new window.google.maps.places.Autocomplete(input, {
      types,
      componentRestrictions,
      fields: ["name", "place_id", "address_components", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const name = place.name ?? input.value;
      const placeId = place.place_id ?? "";
      onSelectRef.current(name, placeId);
    });

    autocompleteRef.current = ac;
  }, [inputRef, types, componentRestrictions]);

  useEffect(() => {
    if (window.google?.maps?.places) {
      init();
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(interval);
        init();
      }
      if (++attempts > 50) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [init]);

  // Geocode the city and restrict autocomplete bounds if cityName changes
  useEffect(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;

    if (!cityName) {
      ac.setBounds(null as any);
      ac.setOptions({ strictBounds: false });
      return;
    }

    if (typeof window === "undefined" || !window.google?.maps?.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: `${cityName}, India` }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const bounds = results[0].geometry.bounds || results[0].geometry.viewport;
        if (bounds) {
          ac.setBounds(bounds);
          ac.setOptions({ strictBounds: true });
        }
      } else {
        // Fallback: clear bounds on failure
        ac.setBounds(null as any);
        ac.setOptions({ strictBounds: false });
      }
    });
  }, [cityName]);
}
