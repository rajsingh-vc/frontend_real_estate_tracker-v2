import {
  LayoutDashboard, Building2, ListChecks, CalendarRange, Map, AlertTriangle,
  Users, ShieldCheck, FileText, BarChart3, Bot, Settings, ClipboardList,
  HandshakeIcon, Landmark, Package, TrendingUp, LogOut, Tags
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "CEO Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Digital Twin", url: "/digital-twin", icon: Map },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Timeline", url: "/timeline", icon: CalendarRange },
];

const operationsItems = [
  { title: "Hurdle Tracker", url: "/hurdles", icon: AlertTriangle },
  { title: "Resources", url: "/resources", icon: Package },
  { title: "Checklists", url: "/checklists", icon: ClipboardList },
  // ✅ NEW: Category Management tab, added under Operations.
  { title: "Category Management", url: "/category-management", icon: Tags },
];

const managementItems = [
  { title: "Compliance", url: "/compliance", icon: ShieldCheck },
  { title: "Handover", url: "/handover", icon: HandshakeIcon },
  { title: "Society", url: "/society", icon: Landmark },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const systemItems = [
  { title: "Delay Prediction", url: "/delay-prediction", icon: TrendingUp },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Admin", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth(); // user: AuthUser | null

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  // Helper to get initials from full name, falling back to username when
  // name is blank. Handles "Company@Role"-style handles like "Vibe@Admin"
  // (-> "VA") in addition to normal "First Last" names.
  const getInitials = (name?: string | null, username?: string | null) => {
    const source = (name && name.trim()) || (username && username.trim()) || "";
    if (!source) return "?";

    if (source.includes("@")) {
      const parts = source.split("@").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      }
      return parts[0]?.charAt(0).toUpperCase() ?? "?";
    }

    return source
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup key={label}>
      {!collapsed && (
        <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold uppercase tracking-wider">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent"
                  activeClassName="bg-sidebar-accent text-sidebar-primary"
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Sidebar Header */}
      <SidebarHeader className="px-4 py-5">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm text-sidebar-foreground">
                Real Estate Tracker
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
                Project Management
              </span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      {/* Sidebar Content */}
      <SidebarContent className="px-2">
        {renderGroup("Main", mainItems)}
        {renderGroup("Operations", operationsItems)}
        {renderGroup("Management", managementItems)}
        {renderGroup("System", systemItems)}
      </SidebarContent>

      {/* Sidebar Footer – dynamic user info */}
      <SidebarFooter className="px-4 py-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2">
          {/* Avatar with initials */}
          <div className="h-8 w-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
            {user ? getInitials(user.name, user.username) : "?"}
          </div>

          {!collapsed && user && (
            <>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium text-sidebar-foreground truncate">
                  {user.name || user.username}
                </span>
                {/* ✅ NEW — superusers have no Role record on the backend
                    (role is null for SuperAdmin by design), so show "Super
                    Admin" explicitly instead of falling back to "User". Any
                    role assigned via Admin > Invite Users (including newly
                    added custom roles) still shows here as-is. */}
                <span className="text-[10px] text-sidebar-foreground/50">
                  {user.is_superuser ? "Super Admin" : user.role || "User"}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="text-sidebar-foreground/50 hover:text-destructive transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}

          {!collapsed && !user && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}