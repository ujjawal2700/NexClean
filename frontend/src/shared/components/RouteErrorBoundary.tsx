import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  /** Where "Go to home" should send the user — the home route of the module this boundary guards. */
  homePath: string;
  /** Label for the home destination, e.g. "customer home", "agent home", "admin home". */
  homeLabel: string;
};

type RouteErrorBoundaryState = { error: Error | null };

/**
 * Catches render crashes within one module (customer/agent/admin/landing) and
 * shows an interactive recovery screen instead of a blank page. Navigation uses
 * a full page load (not the router) so a corrupted app/query-cache state is
 * fully reset, not just re-rendered.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route crashed:", error, info.componentStack);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = this.props.homePath;
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
        <Aurora />
        <GlassCard className="relative z-10 max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <Logo variant="mark" className="text-2xl" />
          </div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            This page hit an unexpected error. You can try refreshing, or head back to your{" "}
            {this.props.homeLabel}.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={this.handleRefresh}>
              <RefreshCw className="size-4" /> Refresh page
            </Button>
            <Button className="flex-1" onClick={this.handleGoHome}>
              <Home className="size-4" /> Go to home
            </Button>
          </div>
        </GlassCard>
      </main>
    );
  }
}
