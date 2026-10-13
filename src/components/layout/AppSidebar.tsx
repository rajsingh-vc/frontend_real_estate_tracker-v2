import { useState } from "react";
import {
  LayoutDashboard, Building2, ListChecks, CalendarRange, Map, AlertTriangle,
  Users, ShieldCheck, FileText, BarChart3, Bot, Settings, ClipboardList,
  HandshakeIcon, Landmark, Package, TrendingUp, LogOut, Tags, MoreVertical, User as UserIcon,
  ChevronLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserProfileModal } from "./UserProfileModal";

const mainItems = [
  { title: "CEO Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Digital Twin", url: "/digital-twin", icon: Map },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Timeline", url: "/timeline", icon: CalendarRange },
];

const baseOperationsItems = [
  { title: "Hurdle Tracker", url: "/hurdles", icon: AlertTriangle },
  { title: "Resources", url: "/resources", icon: Package },
  { title: "Checklists", url: "/checklists", icon: ClipboardList },
  { title: "Category Management", url: "/category-management", icon: Tags, adminOnly: true },
];

const managementItems = [
  { title: "Compliance", url: "/compliance", icon: ShieldCheck },
  { title: "Handover", url: "/handover", icon: HandshakeIcon },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const baseSystemItems = [
  { title: "Delay Prediction", url: "/delay-prediction", icon: TrendingUp },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, adminOnly: true },
  { title: "Admin", url: "/admin", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  // Filter operations items: Category Management only visible to Admin/SuperAdmin
  const operationsItems = baseOperationsItems.filter(
    (item) => !item.adminOnly || isAdmin || isSuperAdmin
  );

  // Filter system items: AI Assistant & Admin only visible to Admin/SuperAdmin
  const systemItems = baseSystemItems.filter(
    (item) => !item.adminOnly || isAdmin || isSuperAdmin
  );

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

  const displayRole = user?.is_superuser
    ? "Super Admin"
    : user?.role || "User";

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        {/* Sidebar Header */}
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (collapsed) {
                  toggleSidebar();
                } else {
                  navigate("/");
                }
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left group cursor-pointer focus:outline-none"
              title={collapsed ? "Maximize sidebar" : "Real Estate Tracker"}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0 shadow-xs group-hover:opacity-90 transition-opacity">
                <Building2 className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-bold text-sm text-sidebar-foreground truncate">
                    Real Estate Tracker
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest truncate">
                    Project Management
                  </span>
                </div>
              )}
            </button>
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 rounded-lg"
                title="Minimize sidebar"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarHeader>

        {/* Sidebar Content */}
        <SidebarContent className="px-2">
          {renderGroup("Main", mainItems)}
          {renderGroup("Operations", operationsItems)}
          {renderGroup("Management", managementItems)}
          {renderGroup("System", systemItems)}
        </SidebarContent>

        {/* Sidebar Footer – Consistent User Identity & Role Section */}
        <SidebarFooter className="px-3 py-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 rounded-xl bg-sidebar-accent/80 hover:bg-sidebar-accent p-2 text-left transition-colors border border-sidebar-border/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary group"
                  title="Account actions"
                >
                  {/* Avatar with initials */}
                  <div className="h-9 w-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
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