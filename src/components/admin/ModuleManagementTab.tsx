import React, { useEffect, useState } from "react";
import {
  LayoutGrid,
  Shield,
  Search,
  Check,
  X,
  AlertTriangle,
  RotateCw,
  Sliders,
  History,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Building2,
  Package,
  ClipboardList,
  Tags,
  ShieldCheck,
  HandshakeIcon,
  FileText,
  BarChart3,
  TrendingUp,
  Bot,
  Settings,
  LayoutDashboard,
  Map,
  ListChecks,
  CalendarRange,
  Loader2,
  Users,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import {
  AppModule,
  MatrixUser,
  ModuleAuditLog,
  ModuleMatrixItem,
  ModuleMatrixResponse,
  modulesApi,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/contexts/ModulesContext";
import { Switch } from "@/components/ui/switch";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Map,
  ListChecks,
  CalendarRange,
  AlertTriangle,
  Package,
  ClipboardList,
  Tags,
  ShieldCheck,
  HandshakeIcon,
  FileText,
  BarChart3,
  TrendingUp,
  Bot,
  Settings,
};

type SubView = "matrix" | "audit";

export function ModuleManagementTab() {
  const { isSuperAdmin } = useAuth();
  const { refreshModules } = useModules();

  const [subView, setSubView] = useState<SubView>("matrix");
  const [matrixData, setMatrixData] = useState<ModuleMatrixResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<ModuleAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [includeAllUsers, setIncludeAllUsers] = useState(false);

  const loadData = async (includeAll: boolean = includeAllUsers) => {
    setLoading(true);
    setError(null);
    try {
      const [matrix, logs] = await Promise.all([
        modulesApi.matrix(includeAll),
        modulesApi.auditLogs().catch(() => []),
      ]);
      setMatrixData(matrix);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err?.message || "Failed to load module configuration matrix.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(includeAllUsers);
  }, [includeAllUsers]);

  const handleToggleUserModule = async (userId: number, moduleKey: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    const key = `user-${userId}-${moduleKey}`;
    setUpdatingKey(key);
    setError(null);
    setActionSuccess(null);

    try {
      await modulesApi.updateUserModules(userId, [
        {
          module_key: moduleKey,
          is_enabled: nextEnabled,
          is_visible: nextEnabled,
        },
      ]);
      setActionSuccess(`Updated ${moduleKey} to ${nextEnabled ? "Enabled" : "Disabled"}.`);
      await loadData();
      await refreshModules();
    } catch (err: any) {
      setError(err?.message || "Failed to update user module visibility.");
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleResetUserModules = async (userId: number, userName: string) => {
    if (!window.confirm(`Reset all custom module overrides for "${userName}"?`)) {
      return;
    }
    setUpdatingKey(`user-reset-${userId}`);
    setError(null);
    setActionSuccess(null);
    try {
      await modulesApi.resetUserModules(userId);
      setActionSuccess(`Successfully reset custom module overrides for ${userName}.`);
      await loadData();
      await refreshModules();
    } catch (err: any) {
      setError(err?.message || "Failed to reset user module overrides.");
    } finally {
      setUpdatingKey(null);
    }
  };

  const categories = ["All", "Main", "Operations", "Management", "System"];

  const modulesList = matrixData?.modules || [];
  const usersList = (matrixData?.users || []).filter((u) => !u.is_superuser);

  const filteredModules = modulesList.filter((m) => {
    const matchesCat = selectedCategory === "All" || m.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.route.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const activeModulesCount = modulesList.filter((m) => (m.is_active ?? m.isActive ?? true)).length;
  const overriddenModulesCount = modulesList.filter((m) => (m.user_overrides_count ?? m.userOverridesCount ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Overview Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Module Management & Visibility
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure application module visibility, toggle modules ON/OFF for users, and manage access policies
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(includeAllUsers)}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-border text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50/70 dark:bg-muted/40 p-3.5 rounded-xl border border-gray-200/80 dark:border-border">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Total Modules</span>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{modulesList.length}</p>
        </div>
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Active Globally</span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{activeModulesCount}</p>
        </div>
        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/40">
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Active Users</span>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{usersList.length}</p>
        </div>
      </div>

      {/* Sub-view Navigation & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-border">
        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-secondary rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setSubView("matrix")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              subView === "matrix"
                ? "bg-white dark:bg-card text-gray-900 dark:text-gray-100 shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            User Visibility Matrix
          </button>
          <button
            type="button"
            onClick={() => setSubView("audit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              subView === "audit"
                ? "bg-white dark:bg-card text-gray-900 dark:text-gray-100 shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <History className="h-3.5 w-3.5 text-gray-500" />
            Audit History
          </button>
        </div>

        {subView !== "audit" && (
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-border bg-gray-50/50 dark:bg-secondary/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-gray-200 dark:border-border rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-secondary text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/60 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}



      {/* Sub-view: Dynamic User Visibility Matrix */}
      {subView === "matrix" && (
        <div className="space-y-3">
          {/* Header Controls for Matrix */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Configurable Users ({usersList.length})
              </span>
              <span className="text-[11px] text-gray-400">
                • Changes take effect immediately & dynamically for each user
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAllUsers}
                  onChange={(e) => setIncludeAllUsers(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Show all team members</span>
              </label>
            </div>
          </div>

          {usersList.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-card border border-dashed border-gray-200 dark:border-border rounded-xl">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                No Configurable Users Yet
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 leading-relaxed">
                Super Admin has full unrestricted access to all 16 modules by default and cannot be restricted.
                When you invite team members and they accept, they will dynamically appear here with interactive ON/OFF visibility switches.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-muted/60 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold sticky left-0 bg-gray-50 dark:bg-muted/60 z-10 border-r border-gray-200 dark:border-border min-w-[220px]">
                        Module
                      </th>
                      {usersList.map((u) => {
                        const isResetting = updatingKey === `user-reset-${u.id}`;
                        return (
                          <th key={u.id} className="px-4 py-3 text-center min-w-[170px] border-r border-gray-100 dark:border-border">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                                {u.name || u.username}
                              </span>
                              <div className="flex items-center gap-1 flex-wrap justify-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    u.is_superuser
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                      : "bg-gray-100 text-gray-700 dark:bg-secondary dark:text-gray-300"
                                  }`}
                                >
                                  {u.role_name || (u.is_superuser ? "Super Admin" : "User")}
                                </span>
                                {u.is_invited && !u.is_superuser && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                    Accepted Invite
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleResetUserModules(u.id, u.name || u.username)}
                                disabled={isResetting}
                                title="Reset all custom overrides for this user"
                                className="mt-1 text-[10px] text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                <RotateCcw className={`h-2.5 w-2.5 ${isResetting ? "animate-spin" : ""}`} />
                                {isResetting ? "Resetting…" : "Reset Overrides"}
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-border">
                    {filteredModules.map((module) => {
                      const IconComp = ICON_MAP[module.icon] || LayoutDashboard;
                      return (
                        <tr key={module.key} className="hover:bg-gray-50/50 dark:hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 sticky left-0 bg-white dark:bg-card z-10 border-r border-gray-200 dark:border-border">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{module.name}</span>
                                <span className="block text-[10px] text-gray-400">{module.category}</span>
                              </div>
                            </div>
                          </td>

                          {usersList.map((user) => {
                            const userAccess = module.users?.[user.id];
                            const isEnabled = userAccess?.is_enabled ?? userAccess?.isEnabled ?? false;
                            const hasOverride = userAccess?.has_override ?? userAccess?.hasOverride ?? false;
                            const isUpdating = updatingKey === `user-${user.id}-${module.key}`;

                            return (
                              <td key={user.id} className="px-4 py-3 text-center border-r border-gray-100 dark:border-border">
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={() => handleToggleUserModule(user.id, module.key, isEnabled)}
                                      disabled={isUpdating}
                                      aria-label={`Toggle ${module.name} for ${user.name}`}
                                      className="data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500"
                                    />
                                    <span
                                      className={`text-[11px] font-bold ${
                                        isEnabled
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-gray-400 dark:text-gray-500"
                                      }`}
                                    >
                                      {isUpdating ? "Saving…" : isEnabled ? "ON" : "OFF"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {hasOverride ? (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50">
                                        Override
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-gray-400">
                                        {user.is_superuser ? "Super Admin" : "Inherited"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Sub-view: Audit History */}
      {subView === "audit" && (
        <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-border bg-gray-50/70 dark:bg-muted/40">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <History className="h-4 w-4 text-blue-600" />
              Recent Module Configuration Audit Logs
            </h3>
          </div>
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No configuration changes recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-border max-h-[500px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 text-xs flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {log.actor_name || log.actorName || "Administrator"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {log.action}
                      </span>
                      {log.target_user_name || log.targetUserName ? (
                        <span className="text-gray-500">
                          Target User: <strong>{log.target_user_name || log.targetUserName}</strong>
                        </span>
                      ) : null}
                      {log.target_role_name || log.targetRoleName ? (
                        <span className="text-gray-500">
                          Target Role: <strong>{log.target_role_name || log.targetRoleName}</strong>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                    {new Date(log.created_at || log.createdAt || "").toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
