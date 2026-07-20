/** Base shimmer block — compose with width/height classes for any shape. */
export declare function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
/** One or more shimmer text lines; the last line is shorter when lines > 1. */
export declare function SkeletonText({ lines, className }: {
    lines?: number;
    className?: string;
}): import("react").JSX.Element;
/** Stat-card grid placeholders — icon chip + value + label, matching StatCard/GlassCard layout. */
export declare function SkeletonStatCards({ count }: {
    count?: number;
}): import("react").JSX.Element;
/** Table row placeholders — drop inside an existing <tbody>. */
export declare function SkeletonTableRows({ rows, cols }: {
    rows?: number;
    cols?: number;
}): import("react").JSX.Element;
/** Stacked list-card placeholders — image/icon block + lines + trailing value, matching GlassCard list rows. */
export declare function SkeletonListCards({ count }: {
    count?: number;
}): import("react").JSX.Element;
