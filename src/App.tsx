import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Link } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ModulesProvider, useModules } from "@/contexts/ModulesContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
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
import { ShieldAlert, Loader2 } from "lucide-react";

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
function AdminRoute({ children }: { children: ReactNode }) {
  const { canManageUsers } = useAuth();
  if (!canManageUsers) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Module access protection wrapper – enforces effective module permissions on route level
function ModuleRoute({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { isModuleEnabled, loading } = useModules();
  const { isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isModuleEnabled(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="h-16 w-16 bg-red-50 dark:bg-red-950/40 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mb-4 border border-red-200 dark:border-red-900/60 shadow-xs">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Module Access Restricted</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mt-1 mb-6">
          You do not have permission to access the{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{moduleKey}</span> module. Please contact
          your site administrator if you require access.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      {/* All other routes are protected */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<ModuleRoute moduleKey="dashboard"><Dashboard /></ModuleRoute>} />
                <Route path="/ceo-dashboard" element={<ModuleRoute moduleKey="dashboard"><Dashboard /></ModuleRoute>} />
                <Route path="/projects" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/tasks/:taskId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/tasks/:taskId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/tasks/:taskId/checklists/:checklistId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId/tasks/:taskId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/projects/:projectId/towers/:towerId/floors/:floorId/units/:unitId/tasks/:taskId/checklists/:checklistId" element={<ModuleRoute moduleKey="projects"><Projects /></ModuleRoute>} />
                <Route path="/digital-twin" element={<ModuleRoute moduleKey="digital-twin"><DigitalTwin /></ModuleRoute>} />
                <Route path="/tasks" element={<ModuleRoute moduleKey="tasks"><Tasks /></ModuleRoute>} />
                <Route path="/timeline" element={<ModuleRoute moduleKey="timeline"><Timeline /></ModuleRoute>} />
                <Route path="/hurdles" element={<ModuleRoute moduleKey="hurdles"><HurdleTracker /></ModuleRoute>} />
                <Route path="/resources" element={<ModuleRoute moduleKey="resources"><Resources /></ModuleRoute>} />
                <Route path="/checklists" element={<ModuleRoute moduleKey="checklists"><Checklists /></ModuleRoute>} />
                <Route path="/category-management" element={<AdminRoute><ModuleRoute moduleKey="category-management"><CategoryManagement /></ModuleRoute></AdminRoute>} />
                <Route path="/compliance" element={<ModuleRoute moduleKey="compliance"><Compliance /></ModuleRoute>} />
                <Route path="/handover" element={<ModuleRoute moduleKey="handover"><Handover /></ModuleRoute>} />
                <Route path="/society" element={<Navigate to="/" replace />} />
                <Route path="/documents" element={<ModuleRoute moduleKey="documents"><Documents /></ModuleRoute>} />
                <Route path="/reports" element={<ModuleRoute moduleKey="reports"><Reports /></ModuleRoute>} />
                <Route path="/ai-assistant" element={<AdminRoute><ModuleRoute moduleKey="ai-assistant"><AIAssistant /></ModuleRoute></AdminRoute>} />
                <Route path="/delay-prediction" element={<ModuleRoute moduleKey="delay-prediction"><DelayPrediction /></ModuleRoute>} />
                <Route path="/admin" element={<AdminRoute><ModuleRoute moduleKey="admin"><Admin /></ModuleRoute></AdminRoute>} />
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
  <ErrorBoundary section="Root Application">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <ModulesProvider>
            <BrowserRouter>
              <ErrorBoundary section="Routes">
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </ModulesProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;