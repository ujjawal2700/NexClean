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

// Marketing/legal content pages — split out so they don't bloat the landing bundle.
const About = lazy(() => import("@modules/landing/pages/About").then((m) => ({ default: m.About })));
const Careers = lazy(() =>
  import("@modules/landing/pages/Careers").then((m) => ({ default: m.Careers })),
);
const Contact = lazy(() =>
  import("@modules/landing/pages/Contact").then((m) => ({ default: m.Contact })),
);
const Help = lazy(() => import("@modules/landing/pages/Help").then((m) => ({ default: m.Help })));
const Privacy = lazy(() =>
  import("@modules/landing/pages/Privacy").then((m) => ({ default: m.Privacy })),
);
const Terms = lazy(() => import("@modules/landing/pages/Terms").then((m) => ({ default: m.Terms })));
const Refund = lazy(() =>
  import("@modules/landing/pages/Refund").then((m) => ({ default: m.Refund })),
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

        {/* Marketing/legal content pages */}
        <Route path="/about" element={<About />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/refund" element={<Refund />} />

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
