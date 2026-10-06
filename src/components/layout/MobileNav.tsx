import { LayoutDashboard, Building2, ListChecks, AlertTriangle, MoreHorizontal } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Map, CalendarRange, Package, ClipboardList, ShieldCheck, HandshakeIcon,
  Landmark, FileText, BarChart3, Bot, Settings, Layers, TrendingUp
} from "lucide-react";

const mainTabs = [
  { title: "CEO", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Hurdles", url: "/hurdles", icon: AlertTriangle },
];

const moreItems = [
  { title: "Digital Twin", url: "/digital-twin", icon: Map },
  { title: "Timeline", url: "/timeline", icon: CalendarRange },
  { title: "Resources", url: "/resources", icon: Package },
  { title: "Checklists", url: "/checklists", icon: ClipboardList },
  { title: "Category Management", url: "/category-management", icon: Layers },
  { title: "Delay Prediction", url: "/delay-prediction", icon: TrendingUp },
  { title: "Compliance", url: "/compliance", icon: ShieldCheck },
  { title: "Handover", url: "/handover", icon: HandshakeIcon },
  { title: "Society", url: "/society", icon: Landmark },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
];

// Only SuperAdmin / users who can manage users see the Admin panel link —
// it was previously shown to every signed-in user regardless of role.
const adminItem = { title: "Admin", url: "/admin", icon: Settings };

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { canManageUsers } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const visibleMoreItems = canManageUsers ? [...moreItems, adminItem] : moreItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.title}
            to={tab.url}
            end={tab.url === "/"}
            className="flex flex-col items-center gap-1 px-3 py-1 text-muted-foreground"
            activeClassName="text-primary"
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.title}</span>
          </NavLink>
        ))}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="flex flex-col items-center gap-1 px-3 py-1 text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <div className="grid grid-cols-3 gap-4 pt-4">
              {visibleMoreItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  className="flex flex-col items-center gap-2 rounded-xl p-3 text-muted-foreground hover:bg-accent/10"
                  activeClassName="text-primary bg-primary/5"
                  onClick={() => setOpen(false)}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}