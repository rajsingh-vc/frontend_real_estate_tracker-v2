import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  UserPlus,
  Activity,
  PlusCircle,
  Trash2,
  User,
  Clock,
  ChevronRight,
} from "lucide-react";
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

export function NotificationBell() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Poll for unread count so the badge stays up to date
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.count;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Fetch full notifications list when the popover opens
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: notificationsApi.list,
    enabled: !!user && open,
  });

  // Mark a single notification as read with optimistic updates
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onMutate: async (id: number) => {
      // Cancel active queries to prevent overwriting optimistic cache
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const previousUnreadCount = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      const previousNotifications = queryClient.getQueryData<ApiNotification[]>(["notifications", "list"]);

      // Check if this item is currently unread before decrementing
      const targetItem = previousNotifications?.find((item) => item.id === id);
      const wasUnread = targetItem ? !targetItem.isRead : true;

      if (wasUnread) {
        queryClient.setQueryData<number>(
          ["notifications", "unread-count"],
          (prev = 0) => Math.max(0, prev - 1)
        );
      }

      // Optimistically update the notification in the list
      if (previousNotifications) {
        queryClient.setQueryData<ApiNotification[]>(
          ["notifications", "list"],
          previousNotifications.map((item) =>
            item.id === id ? { ...item, isRead: true } : item
          )
        );
      }

      return { previousUnreadCount, previousNotifications };
    },
    onError: (_err, _id, context) => {
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(["notifications", "unread-count"], context.previousUnreadCount);
      }
      if (context?.previousNotifications !== undefined) {
        queryClient.setQueryData(["notifications", "list"], context.previousNotifications);
      }
    },
    onSettled: () => {
      // Keep state synchronized with the backend
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });

  // Mark all notifications as read with optimistic updates
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const previousUnreadCount = queryClient.getQueryData<number>(["notifications", "unread-count"]);
      const previousNotifications = queryClient.getQueryData<ApiNotification[]>(["notifications", "list"]);

      queryClient.setQueryData<number>(["notifications", "unread-count"], 0);

      if (previousNotifications) {
        queryClient.setQueryData<ApiNotification[]>(
          ["notifications", "list"],
          previousNotifications.map((item) => ({ ...item, isRead: true }))
        );
      }

      return { previousUnreadCount, previousNotifications };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(["notifications", "unread-count"], context.previousUnreadCount);
      }
      if (context?.previousNotifications !== undefined) {
        queryClient.setQueryData(["notifications", "list"], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });

  if (!user && !isSuperAdmin) return null;

  const handleNotificationClick = (n: ApiNotification) => {
    // Automatically mark as read if not already read (immediately drops badge count)
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }

    // Navigate to the relevant page if targetUrl is provided
    if (n.targetUrl && n.targetUrl.trim() !== "") {
      setOpen(false);
      const url = n.targetUrl.trim();
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.open(url, "_blank");
      } else {
        navigate(url);
      }
    }
  };

  const getVerbIcon = (verb: string) => {
    const v = verb.toLowerCase();
    if (v.includes("invitation") || v.includes("invite")) {
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    }
    if (v.includes("create") || v.includes("added")) {
      return <PlusCircle className="h-4 w-4 text-emerald-500" />;
    }
    if (v.includes("delete") || v.includes("remove")) {
      return <Trash2 className="h-4 w-4 text-rose-500" />;
    }
    return <Activity className="h-4 w-4 text-sky-500" />;
  };

  const getFormattedTime = (dateStr: string) => {
    try {
      if (!dateStr) return "";
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          title="Notifications"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center shadow-xs animate-in fade-in zoom-in-75 duration-150">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 sm:w-96 p-0 shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>

          {notifications.some((n) => !n.isRead) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
              title="Mark all notifications as read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="h-96 max-h-[70vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground space-y-2">
              <Activity className="h-5 w-5 animate-spin text-primary" />
              <p>Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2 px-4">
              <div className="p-3 rounded-full bg-muted/40">
                <Bell className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">
                No new activity or alerts to display right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((n) => {
                const senderUsername =
                  n.actorUsername ||
                  (n.actorName ? n.actorName.toLowerCase().replace(/\s+/g, "_") : null);
                const timeAgo = getFormattedTime(n.createdAt);

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full text-left px-3.5 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors group relative",
                      !n.isRead && "bg-muted/20 hover:bg-muted/30"
                    )}
                  >
                    {/* Action Icon */}
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-muted/60 group-hover:bg-background transition-colors border border-border/40">
                      {getVerbIcon(n.verb)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Sender Username & Timestamp */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 dark:bg-primary/20 px-1.5 py-0.5 rounded">
                          <User className="h-3 w-3" />
                          @{senderUsername || "system"}
                        </span>

                        {timeAgo && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p
                        className={cn(
                          "text-xs leading-relaxed text-foreground/90",
                          !n.isRead && "font-medium text-foreground"
                        )}
                      >
                        {n.description || n.verb}
                      </p>
                    </div>

                    {/* Right side indicators */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center pl-1">
                      {!n.isRead && (
                        <span
                          className="h-2 w-2 rounded-full bg-primary shrink-0 shadow-xs ring-2 ring-primary/20"
                          title="Unread"
                        />
                      )}
                      {n.targetUrl && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}