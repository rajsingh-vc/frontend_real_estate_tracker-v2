import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AcceptInvite from "./components/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import DigitalTwin from "./pages/DigitalTwin";
import Tasks from "./pages/Tasks";
import Timeline from "./pages/Timeline";
import HurdleTracker from "./pages/HurdleTracker";
import Resources from "./pages/Resources";
import Checklists from "./pages/Checklists";
import Compliance from "./pages/Compliance";
import Handover from "./pages/Handover";
import Society from "./pages/Society";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";
import AIAssistant from "./pages/AIAssistant";
import Admin from "./pages/Admin";
import DelayPrediction from "./pages/DelayPrediction";
import CategoryManagement from "./pages/CategoryManagement";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

// Protected route wrapper – redirects to login if not authenticated
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Admin-only route wrapper – only SuperAdmin / users who can manage users
// may reach /admin. Previously this route had no gating at all, so any
// signed-in user (including a plain field user) could open the Admin panel
// by navigating there directly, even though the sidebar link itself is now
// hidden for them.
function AdminRoute({ children }: { children: ReactNode }) {
  const { canManageUsers } = useAuth();
  if (!canManageUsers) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      {/* All other routes are protected */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ceo-dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<Projects />} />
                <Route path="/projects/:projectId/towers/:towerId" element={<Projects />} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId" element={<Projects />} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId" element={<Projects />} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId/tasks/:taskId" element={<Projects />} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId/tasks/:taskId/checklists/:checklistId" element={<Projects />} />
                <Route path="/digital-twin" element={<DigitalTwin />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/hurdles" element={<HurdleTracker />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/checklists" element={<Checklists />} />
                <Route path="/category-management" element={<CategoryManagement />} />
                <Route path="/compliance" element={<Compliance />} />
                <Route path="/handover" element={<Handover />} />
                <Route path="/society" element={<Society />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/ai-assistant" element={<AIAssistant />} />
                <Route path="/delay-prediction" element={<DelayPrediction />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                {/* 404 catch-all inside protected area */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;