type StepperProps = {
    steps: string[];
    current: number;
};
/** Progress indicator for multi-step auth/signup flows. `current` is 0-indexed. */
export declare function Stepper({ steps, current }: StepperProps): import("react").JSX.Element;
export {};
