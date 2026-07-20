type Bar = {
    label: string;
    value: number;
};
/** Lightweight CSS/SVG-free bar chart — no charting dependency. */
export declare function BarChart({ data, format }: {
    data: Bar[];
    format?: (v: number) => string;
}): import("react").JSX.Element;
export {};
