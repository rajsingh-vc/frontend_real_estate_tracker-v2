import React, { useEffect, useState } from "react";
import {
  X,
  Search,
  Check,
  RotateCcw,
  Sliders,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderGit2,
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
} from "lucide-react";
import {
  AppModule,
  User,
  UserModuleConfig,
  ApiProject,
  modulesApi,
} from "@/lib/api";
import { useModules } from "@/contexts/ModulesContext";
import { useAuth } from "@/contexts/AuthContext";
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

interface UserModuleConfigModalProps {
  user: User | null;
  users?: User[]; // Optional for bulk editing
  allProjects?: ApiProject[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UserModuleConfigModal({
  user,
  users,
  allProjects = [],
  open,
  onClose,
  onSuccess,
}: UserModuleConfigModalProps) {
  const isBulk = Boolean(users && users.length > 1);
  const targetUser = user || (users && users[0]);
  const { isSuperAdmin } = useAuth();
  const { refreshModules } = useModules();

  const [modules, setModules] = useState<AppModule[]>([]);
  const [overrides, setOverrides] = useState<
    Record<string, { is_enabled: boolean | null; is_visible: boolean | null }>
  >({});
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const loadUserModules = async () => {
    if (!targetUser) return;
    setLoading(true);
    setError(null);
    try {
      if (isBulk) {
        // Bulk mode: load master module list
        const allMods = await modulesApi.list();
        setModules(allMods);
        // Start with blank/inherit overrides
        const initialOverrides: Record<string, { is_enabled: boolean | null; is_visible: boolean | null }> = {};
        allMods.forEach((m) => {
          initialOverrides[m.key] = { is_enabled: null, is_visible: null };
        });
        setOverrides(initialOverrides);
      } else {
        const data = await modulesApi.getUserModules(targetUser.id, selectedProjectId);
        setModules(data.modules || []);
        const rawOverrides = data.overrides || {};
        const normalizedOverrides: Record<string, { is_enabled: boolean | null; is_visible: boolean | null }> = {};

        (data.modules || []).forEach((m) => {
          const raw = rawOverrides[m.key];
          normalizedOverrides[m.key] = {
            is_enabled: raw ? (raw.is_enabled ?? (raw as any).isEnabled ?? null) : (m.override_enabled ?? (m as any).overrideEnabled ?? null),
            is_visible: raw ? (raw.is_visible ?? (raw as any).isVisible ?? null) : (m.override_visible ?? (m as any).overrideVisible ?? null),
          };
        });
        setOverrides(normalizedOverrides);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load user module permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && targetUser) {
      loadUserModules();
    }
  }, [open, targetUser?.id, selectedProjectId, isBulk]);

  if (!open || !targetUser) return null;

  const handleSetState = (moduleKey: string, state: "allow" | "deny" | "inherit") => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (state === "allow") {
        next[moduleKey] = { is_enabled: true, is_visible: true };
      } else if (state === "deny") {
        next[moduleKey] = { is_enabled: false, is_visible: false };
      } else {
        // Inherit
        next[moduleKey] = { is_enabled: null, is_visible: null };
      }
      return next;
    });
  };

  const handleQuickAll = (action: "allow" | "deny" | "inherit") => {
    setOverrides((prev) => {
      const next = { ...prev };
      modules.forEach((m) => {
        if (action === "allow") {
          next[m.key] = { is_enabled: true, is_visible: true };
        } else if (action === "deny") {
          next[m.key] = { is_enabled: false, is_visible: false };
        } else {
          next[m.key] = { is_enabled: null, is_visible: null };
        }
      });
      return next;
    });
  };

  const handleResetUser = async () => {
    if (isBulk) return;
    if (!window.confirm(`Reset all module overrides for ${targetUser.name} back to inherited role defaults?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await modulesApi.resetUserModules(targetUser.id, selectedProjectId);
      setSuccessMessage("All custom overrides have been reset to inherited role permissions.");
      await refreshModules();
      await loadUserModules();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to reset module permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payloadList: UserModuleConfig[] = Object.entries(overrides).map(([key, val]) => ({
      module_key: key,
      is_enabled: val.is_enabled,
      is_visible: val.is_visible,
    }));

    try {
      if (isBulk && users && users.length > 0) {
        // Only include non-inherit overrides in bulk mode or as instructed
        const modifiedList = payloadList.filter((item) => item.is_enabled !== null || item.is_visible !== null);
        if (modifiedList.length === 0) {
          setError("Please select at least one module policy change to apply in bulk.");
          setSaving(false);
          return;
        }
        const userIds = users.map((u) => u.id);
        const res = await modulesApi.bulkUpdateUserModules(userIds, modifiedList, selectedProjectId);
        setSuccessMessage(res.message || `Module configuration updated for ${users.length} users.`);
      } else {
        const res = await modulesApi.updateUserModules(targetUser.id, payloadList, selectedProjectId);
        setSuccessMessage(res.message || `Module configuration saved for ${targetUser.name}.`);
      }

      await refreshModules();
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Failed to save module configurations.");
    } finally {
      setSaving(false);
    }
  };

  const categories = ["All", "Main", "Operations", "Management", "System"];

  const filteredModules = modules.filter((m) => {
    const matchesCat = selectedCategory === "All" || m.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between bg-gray-50/70 dark:bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/60 shadow-xs">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {isBulk ? `Bulk Module Access (${users?.length} Users)` : `Module Access: ${targetUser.name}`}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isBulk
                  ? `Configuring permissions across ${users?.length} selected users`
                  : `Role: ${targetUser.role || "No Role"} • ${targetUser.email}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-muted transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Project Scope Filter & Quick Controls Bar */}
        <div className="px-5 py-3 bg-white dark:bg-card border-b border-gray-100 dark:border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Project Scope:</span>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs border border-gray-200 dark:border-border rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-muted text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Global (All Projects)</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickAll("allow")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 transition-colors"
            >
              Enable All
            </button>
            <button
              type="button"
              onClick={() => handleQuickAll("deny")}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 transition-colors"
            >
              Disable All
            </button>
            {!isBulk && (
              <button
                type="button"
                onClick={handleResetUser}
                disabled={saving}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted transition-colors flex items-center gap-1"
                title="Reset overrides to inherited defaults"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Defaults
              </button>
            )}
          </div>
        </div>

        {/* Search & Category Pills */}
        <div className="px-5 pt-3 pb-2 border-b border-gray-100 dark:border-border space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules (e.g. Hurdle Tracker, Checklists, Tasks)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-border bg-gray-50/50 dark:bg-secondary/60 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/60 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading module configurations…</span>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              No modules match your current filter.
            </div>
          ) : (
            filteredModules.map((module) => {
              const IconComp = ICON_MAP[module.icon] || LayoutDashboard;
              const override = overrides[module.key];
              const isOverridden = override && override.is_enabled !== null;
              const isEnabled = isOverridden ? override.is_enabled : module.is_enabled;

              return (
                <div
                  key={module.key}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    override?.is_enabled === false
                      ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40"
                      : override?.is_enabled === true
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                      : "bg-white dark:bg-card border-gray-200/80 dark:border-border hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                        isEnabled
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                          : "bg-gray-100 dark:bg-muted text-gray-400 border-gray-200 dark:border-border"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {module.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-secondary text-gray-600 dark:text-gray-300 font-medium">
                          {module.category}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {module.route}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {module.description || "System module"}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        {override?.is_enabled === true ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Custom Override: Enabled
                          </span>
                        ) : override?.is_enabled === false ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3 w-3" /> Custom Override: Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            Inheriting Role Policy ({module.is_enabled ? "Active" : "Disabled"})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Direct Toggle Switch ON / OFF */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isEnabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {isEnabled ? "ON" : "OFF"}
                      </span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleSetState(module.key, checked ? "allow" : "deny")}
                        aria-label={`Toggle access for ${module.name}`}
                        className="data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500"
                      />
                    </div>

                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => handleSetState(module.key, "inherit")}
                        className="text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline"
                        title="Revert override to inherited role policy"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-border bg-gray-50/70 dark:bg-muted/40 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {Object.values(overrides).filter((o) => o.is_enabled !== null).length} custom override(s) configured
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Apply & Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
