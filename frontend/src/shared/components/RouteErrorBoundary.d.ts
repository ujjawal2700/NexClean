import { Component, type ErrorInfo, type ReactNode } from "react";
type RouteErrorBoundaryProps = {
    children: ReactNode;
    /** Where "Go to home" should send the user — the home route of the module this boundary guards. */
    homePath?: string;
    /** Label for the home destination, e.g. "customer home", "cleaner home", "admin home". */
    homeLabel?: string;
};
type RouteErrorBoundaryState = {
    error: Error | null;
};
/**
 * Catches render crashes within one module (customer/agent/admin/landing) and
 * shows an interactive recovery screen instead of a blank page. Navigation uses
 * a full page load (not the router) so a corrupted app/query-cache state is
 * fully reset, not just re-rendered.
 */
export declare class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
    state: RouteErrorBoundaryState;
    static getDerivedStateFromError(error: Error): RouteErrorBoundaryState;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    getHomeDetails: () => {
        homePath: string;
        homeLabel: string;
    };
    handleRefresh: () => void;
    handleGoHome: () => void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import("react").ReactPortal | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | import("react").JSX.Element | null | undefined;
}
export {};
