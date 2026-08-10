import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, normalizeUser } from "@/lib/api"; // Import the shared User type

// Alias kept for components that import `AuthUser` from this module (e.g.
// AppLayout.tsx) — it's just the same shape as `User` from api.ts. This
// name didn't actually exist before, so any file importing it was pulling
// in `undefined` at runtime; harmless while only used as a type (erased by
// the bundler), but it fails a real type-check.
export type AuthUser = User;

// ---- Token keys and helpers – defined here so no extra file is needed ----
const ACCESS_TOKEN_KEY = "apex_access_token";
const REFRESH_TOKEN_KEY = "apex_refresh_token";
const USER_KEY = "apex_auth_user";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// Called by api.ts after a successful silent refresh. `refresh` is optional
// because it's only returned when SIMPLE_JWT.ROTATE_REFRESH_TOKENS is on.
export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

// Called by api.ts when the refresh token itself is expired/invalid, and by
// logout(). Only clears storage — does not touch React state, since it may
// be called from outside a component (see api.ts).
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;  // Now uses the full User type from api.ts
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canManageUsers: boolean;
  lastLoginError: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Flattens a DRF-style error body ({"field": ["msg", ...], "non_field_errors": [...]})
// into a single readable string, without assuming any particular field name.
function extractErrorMessage(details: unknown): string {
  if (!details) return "Login failed.";
  if (typeof details === "string") return details;
  if (typeof details === "object") {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
      const msg = Array.isArray(value) ? value.join(" ") : String(value);
      parts.push(field === "non_field_errors" || field === "detail" ? msg : `${field}: ${msg}`);
    }
    if (parts.length) return parts.join(" | ");
  }
  return "Login failed.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  });
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [lastLoginError, setLastLoginError] = useState<string | null>(null);

  const login = async (username: string, password: string): Promise<boolean> => {
    console.log("🔐 login() called with:", { username, password });

    console.log("🔄 Trying backend login for:", username);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let details: unknown = null;
        try {
          details = await res.json();
        } catch {
          details = await res.text().catch(() => null);
        }
        const message = extractErrorMessage(details);
        console.warn("❌ Backend login failed:", res.status, details);
        setLastLoginError(message);
        return false;
      }

      const data = await res.json();
      const normalizedUser = normalizeUser(data.user);
      setTokens(data.access, data.refresh);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      setIsAuthenticated(true);
      setLastLoginError(null);
      console.log("✅ Backend login successful");
      return true;
    } catch (error) {
      console.error("❌ Backend login error:", error);
      setLastLoginError("Network error — could not reach the server.");
      return false;
    }
  };

  const logout = () => {
    const access = getAccessToken();
    const refresh = getRefreshToken();

    if (access && refresh) {
      fetch(`${API_BASE_URL}/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ refresh }),
      }).catch(() => {});
    }

    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    console.log("👋 User logged out");
  };

  // Fetch the current user from the backend (used to refresh user data)
  const fetchMe = async (): Promise<void> => {
    const access = getAccessToken();
    if (!access) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/`, {
        headers: {
          Authorization: `Bearer ${access}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearTokens();
          setUser(null);
          setIsAuthenticated(false);
        }
        return;
      }
      const data = await res.json();
      const normalizedUser = normalizeUser(data);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      // Optionally clear tokens if network error
    }
  };

  // Admin status is driven by real backend permission flags (see
  // accounts.UserSerializer: can_manage_users, is_superuser), NOT by
  // matching the display role name. Role names are free text set per
  // company (e.g. "Admin", "Project Head", a custom title) — string
  // matching against a fixed list silently breaks the moment a role is
  // renamed, or falsely grants access to any role that happens to be
  // named "Admin"/"CEO" without actually carrying that permission.
  const isSuperAdmin = !!user?.is_superuser;
  const canManageUsers = !!user && (user.is_superuser || user.can_manage_users);
  // "isAdmin" here means "sees the Admin panel" — same condition.
  const isAdmin = canManageUsers;

  // ✅ FIXED — `user` state above is seeded once from localStorage and was
  // never refreshed after that: `fetchMe()` existed but nothing ever called
  // it, so the browser kept using whatever user object was cached at the
  // last login/refresh forever. That's why a permission fix on the backend
  // (e.g. UserSerializer starting to return can_manage_users) had no visible
  // effect for an already-logged-in Admin — their cached user object
  // predates the field, so `canManageUsers` stayed false and /admin kept
  // bouncing to "/" until they logged out and back in. Refreshing once on
  // mount (whenever an access token is already present) means a stale
  // cached user — missing fields, a changed role, a revoked permission,
  // a deactivated account — gets corrected automatically on next load,
  // without requiring a manual logout.
  useEffect(() => {
    if (getAccessToken()) {
      fetchMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        fetchMe,
        isAdmin,
        isSuperAdmin,
        canManageUsers,
        lastLoginError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}