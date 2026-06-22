import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { KycGate } from "./components/KycGate";
import { AgentLayout } from "./components/AgentLayout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { JobDetail } from "./pages/JobDetail";
import { Earnings } from "./pages/Earnings";
import { Profile } from "./pages/Profile";

/**
 * Agent module router (base path /agent). Login is public; everything else
 * is wrapped in AgentLayout behind the auth guard.
 */
export function AgentApp() {
  return (
    <RouteErrorBoundary homePath="/agent" homeLabel="cleaner home">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />

        <Route
          element={
            <ProtectedRoute>
              <KycGate>
                <AgentLayout>
                  <Outlet />
                </AgentLayout>
              </KycGate>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
