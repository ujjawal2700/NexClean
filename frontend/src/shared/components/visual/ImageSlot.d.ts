type ImageSlotProps = {
    /** drop a real asset path here later; until then a branded placeholder shows */
    src?: string;
    alt?: string;
    /** label shown on the placeholder so the client knows what goes here */
    label?: string;
    className?: string;
    rounded?: string;
};
/**
 * Branded media placeholder. Renders the image when `src` is provided,
 * otherwise a tasteful gradient slot indicating what asset belongs here.
 * Lets the whole landing page ship before real photography/video exists.
 */
export declare function ImageSlot({ src, alt, label, className, rounded }: ImageSlotProps): import("react").JSX.Element;
export {};
