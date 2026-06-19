import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@modules/landing/LandingPage";
import { PageLoader } from "@shared/components/PageLoader";

// Role modules are code-split: landing visitors never download
// customer/agent/admin bundles until those routes are visited.
const CustomerApp = lazy(() =>
  import("@modules/customer/CustomerApp").then((m) => ({ default: m.CustomerApp })),
);
const AgentApp = lazy(() =>
  import("@modules/agent/AgentApp").then((m) => ({ default: m.AgentApp })),
);
const AdminApp = lazy(() =>
  import("@modules/admin/AdminApp").then((m) => ({ default: m.AdminApp })),
);

/**
 * Central route map. Each role owns a base path; real sub-routes are added
 * as each module is built. Auth/role guards will wrap these in later phases.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public marketing (eager — first paint matters) */}
        <Route path="/" element={<LandingPage />} />

        {/* Customer module */}
        <Route path="/app/*" element={<CustomerApp />} />

        {/* Agent (cleaner) module */}
        <Route path="/agent/*" element={<AgentApp />} />

        {/* Admin module (web-based, role-routed) */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Fallback */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  );
}
