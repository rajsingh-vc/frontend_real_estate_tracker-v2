import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { AppModule, modulesApi } from "@/lib/api";
import { useAuth } from "./AuthContext";

interface ModulesContextType {
  modules: AppModule[];
  visibleModules: AppModule[];
  moduleMap: Record<string, { is_enabled: boolean; is_visible: boolean }>;
  isModuleEnabled: (key: string) => boolean;
  isModuleVisible: (key: string) => boolean;
  refreshModules: (projectId?: number) => Promise<void>;
  loading: boolean;
}

const ModulesContext = createContext<ModulesContextType | null>(null);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [modules, setModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const normalizeModule = (m: any): AppModule => {
    const is_enabled = m.is_enabled ?? m.isEnabled ?? true;
    const is_visible = m.is_visible ?? m.isVisible ?? true;
    const is_active = m.is_active ?? m.isActive ?? true;
    return {
      id: m.id,
      key: m.key,
      name: m.name,
      description: m.description || "",
      category: m.category || "Main",
      route: m.route || "/",
      icon: m.icon || "",
      order: m.order ?? 0,
      is_active,
      is_enabled,
      is_visible,
      source: m.source,
      default_enabled: m.default_enabled ?? m.defaultEnabled ?? true,
      default_visible: m.default_visible ?? m.defaultVisible ?? true,
      admin_only: m.admin_only ?? m.adminOnly ?? false,
      override_enabled: m.override_enabled ?? m.overrideEnabled ?? null,
      override_visible: m.override_visible ?? m.overrideVisible ?? null,
    };
  };

  const refreshModules = useCallback(async (projectId?: number) => {
    if (!localStorage.getItem("apex_access_token")) {
      setModules([]);
      setLoading(false);
      return;
    }

    try {
      const data = await modulesApi.myPermissions(projectId);
      const rawList = data?.modules || [];
      const normalized = rawList.map(normalizeModule);
      setModules(normalized);
    } catch (err) {
      console.warn("Could not fetch user module permissions:", err);
      // Fallback: if user is superuser, leave open
      if (user?.is_superuser) {
        // Will rely on fallback defaults
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshModules();
    } else {
      setModules([]);
      setLoading(false);
    }
  }, [isAuthenticated, refreshModules]);

  const moduleMap = modules.reduce<Record<string, { is_enabled: boolean; is_visible: boolean }>>(
    (acc, m) => {
      acc[m.key] = {
        is_enabled: !!m.is_enabled,
        is_visible: !!m.is_visible,
      };
      return acc;
    },
    {}
  );

  const isModuleEnabled = useCallback(
    (key: string): boolean => {
      if (user?.is_superuser) return true;
      if (loading) return true; // optimistic during fast initial boot
      const entry = moduleMap[key];
      return entry ? entry.is_enabled : false;
    },
    [user, loading, moduleMap]
  );

  const isModuleVisible = useCallback(
    (key: string): boolean => {
      if (user?.is_superuser) return true;
      if (loading) return true;
      const entry = moduleMap[key];
      return entry ? entry.is_visible : false;
    },
    [user, loading, moduleMap]
  );

  const visibleModules = modules.filter((m) => {
    if (user?.is_superuser) return true;
    return !!m.is_visible;
  });

  return (
    <ModulesContext.Provider
      value={{
        modules,
        visibleModules,
        moduleMap,
        isModuleEnabled,
        isModuleVisible,
        refreshModules,
        loading,
      }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModulesContext);
  if (!ctx) throw new Error("useModules must be used within ModulesProvider");
  return ctx;
}
