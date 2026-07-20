type ModulePlaceholderProps = {
    module: string;
    phase: string;
    description: string;
};
/**
 * Temporary landing surface for modules not yet built (customer/agent/admin).
 * Keeps routing wired and the design system visible until each phase begins.
 */
export declare function ModulePlaceholder({ module, phase, description }: ModulePlaceholderProps): import("react").JSX.Element;
export {};
