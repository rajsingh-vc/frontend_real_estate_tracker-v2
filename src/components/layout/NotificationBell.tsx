import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, UserPlus, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { notificationsApi, type ApiNotification } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Only SuperAdmins receive activity/invite-accept notifications today (see
// backend notifications app), so the bell only needs to poll for them.
// If per-user notifications are added later, this guard can just be
// dropped — the query/UI below already works for any authenticated user.
export function NotificationBell() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await notificationsApi.unreadCount()).count,
    enabled: isSuperAdmin,
    // Poll so the badge updates without a full page reload — this is a
    // simple, dependable stand-in for push/websocket delivery.
    refetchInterval: 30_000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: notificationsApi.list,
    enabled: isSuperAdmin && open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (!isSuperAdmin) return null;

  const handleNotificationClick = (n: ApiNotification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.targetUrl) {
      setOpen(false);
      navigate(n.targetUrl);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {notifications.some((n) => !n.isRead) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              You're all caught up.
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-muted/50 transition-colors",
                    !n.isRead && "bg-muted/30"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.verb.includes("invitation") ? (
                      <UserPlus className="h-4 w-4 text-primary" />
                    ) : (
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", !n.isRead && "font-medium")}>
                      {n.description || n.verb}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}