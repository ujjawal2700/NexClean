export type VehicleSelection = {
    brand: string;
    model: string;
    categoryKey: string;
};
type Props = {
    onResolved: (selection: VehicleSelection | null) => void;
};
/**
 * Brand > model picker. The category is derived from whichever model is
 * picked (a brand spans many categories) and reported via onResolved — the
 * parent never has to ask the customer for a category directly. Falls back
 * to a manual name + category entry if their car isn't in the catalog yet.
 */
export declare function BrandModelSelect({ onResolved }: Props): import("react").JSX.Element;
export {};
