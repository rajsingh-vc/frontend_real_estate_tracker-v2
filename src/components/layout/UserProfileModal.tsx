import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User as UserIcon,
  Mail,
  AtSign,
  Shield,
  Building2,
  FolderGit2,
  Clock,
  CheckCircle2,
  Phone,
} from "lucide-react";
import type { User } from "@/lib/api";

interface UserProfileModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  open,
  onOpenChange,
}) => {
  if (!user) return null;

  const displayName = user.name || user.username || "User";
  const displayRole = user.is_superuser
    ? "Super Admin"
    : user.role || "Standard User";

  const getInitials = (name?: string, username?: string) => {
    const src = (name && name.trim()) || (username && username.trim()) || "?";
    return src
      .split(/\s+/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formattedLastLogin = user.last_login
    ? new Date(user.last_login).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never logged in";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl rounded-2xl overflow-hidden p-0">
        {/* Profile Card Header Banner */}
        <div className="relative bg-gradient-to-tr from-primary/90 via-primary to-indigo-600 p-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-xl font-bold shadow-lg">
              {getInitials(user.name, user.username)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate leading-tight">
                {displayName}
              </h2>
              <p className="text-xs text-primary-foreground/80 flex items-center gap-1 mt-0.5">
                <AtSign className="h-3 w-3" />
                <span>{user.username}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 text-[10px] font-semibold uppercase tracking-wider"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {displayRole}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`border-white/20 text-[10px] font-semibold ${
                    user.is_active
                      ? "bg-emerald-500/30 text-white"
                      : "bg-rose-500/30 text-white"
                  }`}
                >
                  {user.is_active ? "Account Active" : "Account Disabled"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Email */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Mail className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Email Address
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {user.email || "No email registered"}
                </span>
              </div>
            </div>

            {/* Organization */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Organization
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {user.company_name || (user.is_superuser ? "System Global" : "Default Organization")}
                </span>
              </div>
            </div>

            {/* Department */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <UserIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Department
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {user.department || "Operations & Construction"}
                </span>
              </div>
            </div>

            {/* Last Login */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Last Login
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {formattedLastLogin}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Projects Section */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-primary" />
                <span>Assigned Projects & Access</span>
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                {user.is_superuser
                  ? "All Projects (SuperAdmin)"
                  : user.assigned_projects && user.assigned_projects.length > 0
                  ? `${user.assigned_projects.length} Assigned`
                  : "Organization Portfolio"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
              {user.is_superuser ? (
                <span className="text-xs text-muted-foreground italic">
                  Full unrestricted access to all tenant projects across the organization.
                </span>
              ) : user.assigned_projects && user.assigned_projects.length > 0 ? (
                user.assigned_projects.map((proj, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-[11px] bg-background border px-2 py-0.5"
                  >
                    {proj}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Access to all authorized projects under {user.company_name || "assigned organization"}.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/40 px-5 py-3 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Close Profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
