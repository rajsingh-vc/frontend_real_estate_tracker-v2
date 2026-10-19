import { useState } from "react";
import {
  LayoutDashboard, Building2, ListChecks, CalendarRange, Map, AlertTriangle,
  Users, ShieldCheck, FileText, BarChart3, Bot, Settings, ClipboardList,
  HandshakeIcon, Landmark, Package, TrendingUp, LogOut, Tags, MoreVertical, User as UserIcon,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/contexts/ModulesContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserProfileModal } from "./UserProfileModal";

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
  Users,
  Landmark,
};

// Fallback ordering of categories to maintain consistent navigation grouping
const CATEGORY_ORDER = ["Main", "Operations", "Management", "System"];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { visibleModules, loading: modulesLoading } = useModules();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  // Helper to get initials from full name, falling back to username
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

  const displayRole = user?.is_superuser
    ? "Super Admin"
    : user?.role || "User";

  // Group visible modules dynamically by category
  const groupedModules = CATEGORY_ORDER.map((category) => ({
    category,
    items: visibleModules.filter((m) => m.category === category),
  })).filter((group) => group.items.length > 0);

  // Catch any custom categories not in CATEGORY_ORDER
  const otherCategories = Array.from(
    new Set(
      visibleModules
        .map((m) => m.category)
        .filter((cat) => !CATEGORY_ORDER.includes(cat))
    )
  );

  otherCategories.forEach((cat) => {
    const items = visibleModules.filter((m) => m.category === cat);
    if (items.length > 0) {
      groupedModules.push({ category: cat, items });
    }
  });

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        {/* Sidebar Header – Enhanced Notandas Realty Branding & Dynamic Minimize/Maximize */}
        <SidebarHeader className={collapsed ? "px-1.5 py-3" : "px-3 py-3.5 sm:px-3.5 sm:py-4"}>
          <div className={`flex items-center ${collapsed ? "flex-col justify-center gap-2" : "justify-between gap-2.5"}`}>
            <button
              type="button"
              onClick={() => {
                if (collapsed) {
                  toggleSidebar();
                } else {
                  navigate("/");
                }
              }}
              className={`flex items-center gap-3 min-w-0 text-left group cursor-pointer focus:outline-none ${collapsed ? "justify-center" : "flex-1"}`}
              title={collapsed ? "Maximize sidebar" : "Notandas Realty"}
            >
              {/* Sized container with building clearly visible */}
              <div
                className={`relative flex items-center justify-center rounded-xl overflow-hidden shrink-0 shadow-sm border border-sidebar-border/80 bg-slate-900 group-hover:scale-105 transition-all ${
                  collapsed ? "h-9 w-9" : "h-11 w-11 sm:h-12 sm:w-12"
                }`}
              >
                <img
                  src="/image.png"
                  alt="Notandas Realty"
                  className="h-full w-full object-cover object-center scale-[1.38]"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                    const fallback = e.currentTarget.parentElement?.querySelector(".sidebar-fallback-icon");
                    if (fallback) (fallback as HTMLElement).style.display = "flex";
                  }}
                />
                <div className="sidebar-fallback-icon hidden h-full w-full items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>

              {!collapsed && (
                <div className="flex flex-col min-w-0 justify-center">
                  <span className="font-display font-bold text-[15px] text-sidebar-foreground truncate tracking-tight leading-tight group-hover:text-sidebar-primary transition-colors">
                    Notandas Realty
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/65 uppercase tracking-widest truncate font-semibold mt-0.5 leading-none">
                    Konstruct Tracker
                  </span>
                </div>
              )}
            </button>

            {/* Minimize / Maximize toggle button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={`text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 rounded-lg transition-colors ${
                collapsed ? "h-7 w-7 mt-0.5" : "h-7 w-7"
              }`}
              title={collapsed ? "Maximize sidebar" : "Minimize sidebar"}
              aria-label={collapsed ? "Maximize sidebar" : "Minimize sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </SidebarHeader>

        {/* Sidebar Content – Fully Dynamic Role & User Based Navigation */}
        <SidebarContent className="px-2">
          {modulesLoading && visibleModules.length === 0 ? (
            <div className="p-4 flex items-center justify-center gap-2 text-sidebar-foreground/50 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" />
              {!collapsed && <span>Loading modules…</span>}
            </div>
          ) : (
            groupedModules.map(({ category, items }) => (
              <SidebarGroup key={category}>
                {!collapsed && (
                  <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold uppercase tracking-wider">
                    {category}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => {
                      const IconComponent = ICON_MAP[item.icon] || LayoutDashboard;

                      // Dynamic module naming:
                      // If key is 'dashboard' or 'CEO Dashboard':
                      //   - SuperAdmin: "Dashboard"
                      //   - User with organization: `${user.company_name} Dashboard` (e.g. "Notan Edge Dashboard")
                      //   - Otherwise: "Dashboard"
                      let displayName = item.name;
                      if (item.key === "dashboard" || item.name === "CEO Dashboard") {
                        if (user?.is_superuser) {
                          displayName = "Dashboard";
                        } else if (user?.company_name && user.company_name.trim() && user.company_name !== "Primary Tenant") {
                          displayName = `${user.company_name.trim()} Dashboard`;
                        } else {
                          displayName = "Dashboard";
                        }
                      }

                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton asChild isActive={isActive(item.route)} tooltip={displayName}>
                            <NavLink
                              to={item.route}
                              end={item.route === "/"}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent"
                              activeClassName="bg-sidebar-accent text-sidebar-primary"
                            >
                              <IconComponent className="h-5 w-5 shrink-0" />
                              {!collapsed && <span className="truncate">{displayName}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
        </SidebarContent>

        <SidebarFooter className={collapsed ? "p-1.5" : "px-3 py-3"}>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-full flex items-center rounded-xl bg-sidebar-accent/80 hover:bg-sidebar-accent text-left transition-colors border border-sidebar-border/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary group ${
                    collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"
                  }`}
                  title={user.name || user.username}
                >
                  {/* Avatar with initials */}
                  <div className="h-8 w-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                    {getInitials(user.name, user.username)}
                  </div>

                  {!collapsed && (
                    <div className="flex flex-col flex-1 min-w-0 pr-1">
                      <span className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                        {user.name || user.username}
                      </span>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 h-3.5 bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20 font-medium"
                        >
                          {displayRole}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {!collapsed && (
                    <MoreVertical className="h-4 w-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground shrink-0" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
                <div className="px-3 py-2 border-b">
                  <p className="text-xs font-bold truncate">{user.name || user.username}</p>
                  <p className="text-[10px] text-primary font-medium mt-0.5">{displayRole}</p>
                </div>
                <DropdownMenuItem
                  onClick={() => setProfileModalOpen(true)}
                  className="text-xs cursor-pointer py-2"
                >
                  <UserIcon className="h-3.5 w-3.5 mr-2" />
                  <span>View Full Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-xs cursor-pointer py-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">Loading user…</div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* User Profile Modal */}
      <UserProfileModal
        user={user}
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />
    </>
  );
}