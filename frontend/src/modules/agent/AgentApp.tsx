import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgentLayout } from "./components/AgentLayout";
import { Login } from "./pages/Login";
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
    <Routes>
      <Route path="login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AgentLayout>
              <Outlet />
            </AgentLayout>
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
  );
}
