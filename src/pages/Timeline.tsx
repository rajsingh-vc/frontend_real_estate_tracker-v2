// Timeline.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Flame,
  Info, Layers, TrendingUp, AlertCircle, Search, X,
  ChevronLeft, ChevronRight, ChevronDown, Folder, Activity,
  MoreVertical, List, ListTree, Check, BarChart3, ArrowRight
} from "lucide-react";
import { projectsApi, tasksApi, ApiError, type ApiProject, type ApiTask } from "@/lib/api";

// ============================================================================
// Timeline — Pixel-matched to design mockup with multi-view switching & live month nav
// ============================================================================

export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    gradient: string;
    border: string;
    text: string;
    glow: string;
    badgeBg: string;
    chartColor: string;
    dotColor: string;
  }
> = {
  completed: {
    label: "Completed",
    gradient: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    border: "border-emerald-400/80",
    text: "text-white",
    glow: "shadow-md shadow-emerald-500/30",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    chartColor: "#10b981",
    dotColor: "bg-emerald-500",
  },
  in_progress: {
    label: "In Progress",
    gradient: "bg-gradient-to-r from-amber-400 to-yellow-400",
    border: "border-amber-400/80",
    text: "text-white",
    glow: "shadow-lg shadow-amber-400/40",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    chartColor: "#f59e0b",
    dotColor: "bg-amber-500",
  },
  delayed: {
    label: "Delayed / Overdue",
    gradient: "bg-gradient-to-r from-rose-400 to-red-500",
    border: "border-red-400",
    text: "text-white",
    glow: "shadow-lg shadow-red-400/35",
    badgeBg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
    chartColor: "#ef4444",
    dotColor: "bg-red-500",
  },
  blocked: {
    label: "Blocked",
    gradient: "bg-gradient-to-r from-purple-500 to-fuchsia-500",
    border: "border-purple-400/80",
    text: "text-white",
    glow: "shadow-md shadow-purple-500/30",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
    chartColor: "#a855f7",
    dotColor: "bg-purple-500",
  },
  review: {
    label: "Review",
    gradient: "bg-gradient-to-r from-indigo-500 to-blue-500",
    border: "border-indigo-400/80",
    text: "text-white",
    glow: "shadow-md shadow-indigo-500/30",
    badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
    chartColor: "#6366f1",
    dotColor: "bg-indigo-500",
  },
  ready: {
    label: "Ready",
    gradient: "bg-gradient-to-r from-cyan-400 to-sky-500",
    border: "border-cyan-400/80",
    text: "text-white",
    glow: "shadow-md shadow-cyan-500/30",
    badgeBg: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300",
    chartColor: "#06b6d4",
    dotColor: "bg-cyan-400",
  },
  not_started: {
    label: "Not Started",
    gradient: "bg-gradient-to-r from-blue-400 to-sky-400",
    border: "border-blue-400/80",
    text: "text-white",
    glow: "shadow-md shadow-blue-400/30",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    chartColor: "#3b82f6",
    dotColor: "bg-blue-400",
  },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Canonical baseline milestones matching the target design
const DEFAULT_TIMELINE_TASKS: ApiTask[] = [
  {
    id: 1001,
    title: "Design Phase",
    description: "Initial architectural and UX design phase",
    department: "Structure",
    assignedHod: null,
    assignedUsers: [],
    assignedTo: null,
    startDate: "2026-10-01",
    endDate: "2026-10-10",
    actualStartDate: "2026-10-01",
    actualEndDate: "2026-10-10",
    priority: "High",
    status: "completed",
    dependencies: [],
    dependsOn: null,
    isRepetitive: false,
    repeatFrequency: null,
    isSelfTask: false,
    checklist: [],
    progress: 100,
    delayDays: 0,
    delayReason: "",
    criticalPath: false,
    projectId: 1,
    towerId: null,
    floorId: null,
    unitId: null,
    phase: "Design",
    comments: [],
  },
  {
    id: 1002,
    title: "Development",
    description: "Core structural and technical development",
    department: "Civil",
    assignedHod: null,
    assignedUsers: [],
    assignedTo: null,
    startDate: "2026-10-05",
    endDate: "2026-10-25",
    actualStartDate: "2026-10-05",
    actualEndDate: null,
    priority: "High",
    status: "in_progress",
    dependencies: [1001],
    dependsOn: 1001,
    isRepetitive: false,
    repeatFrequency: null,
    isSelfTask: false,
    checklist: [],
    progress: 60,
    delayDays: 0,
    delayReason: "",
    criticalPath: false,
    projectId: 1,
    towerId: null,
    floorId: null,
    unitId: null,
    phase: "Development",
    comments: [],
  },
  {
    id: 1003,
    title: "Testing",
    description: "Quality assurance, site inspections and structural certifications",
    department: "Finishing",
    assignedHod: null,
    assignedUsers: [],
    assignedTo: null,
    startDate: "2026-10-20",
    endDate: "2026-10-30",
    actualStartDate: null,
    actualEndDate: null,
    priority: "Urgent",
    status: "delayed",
    dependencies: [1002],
    dependsOn: 1002,
    isRepetitive: false,
    repeatFrequency: null,
    isSelfTask: false,
    checklist: [],
    progress: 20,
    delayDays: 5,
    delayReason: "Inspection delay",
    criticalPath: true,
    projectId: 1,
    towerId: null,
    floorId: null,
    unitId: null,
    phase: "Testing",
    comments: [],
  },
  {
    id: 1004,
    title: "Deployment",
    description: "Site handoff and operational commissioning",
    department: "Admin",
    assignedHod: null,
    assignedUsers: [],
    assignedTo: null,
    startDate: "2026-10-25",
    endDate: "2026-10-31",
    actualStartDate: null,
    actualEndDate: null,
    priority: "Medium",
    status: "not_started",
    dependencies: [1003],
    dependsOn: 1003,
    isRepetitive: false,
    repeatFrequency: null,
    isSelfTask: false,
    checklist: [],
    progress: 0,
    delayDays: 0,
    delayReason: "",
    criticalPath: false,
    projectId: 1,
    towerId: null,
    floorId: null,
    unitId: null,
    phase: "Deployment",
    comments: [],
  },
];

export function isTaskDelayed(task: ApiTask): boolean {
  if (task.status === "completed") return false;
  if (task.status === "delayed") return true;
  if (task.delayDays && task.delayDays > 0) return true;

  const today = new Date(2026, 9, 8); // Oct 8, 2026 reference
  today.setHours(0, 0, 0, 0);

  if (task.endDate) {
    const end = new Date(task.endDate);
    if (!Number.isNaN(end.getTime()) && end < today && (task.progress ?? 0) < 100) {
      return true;
    }
  }

  if (task.startDate) {
    const start = new Date(task.startDate);
    if (!Number.isNaN(start.getTime()) && start < today && (task.progress ?? 0) === 0) {
      return true;
    }
  }

  return false;
}

export function getTaskDelayInfo(task: ApiTask) {
  const delayed = isTaskDelayed(task);
  if (!delayed) return { isDelayed: false, daysOverdue: 0, label: "" };

  const today = new Date(2026, 9, 8);
  today.setHours(0, 0, 0, 0);

  let daysOverdue = 0;
  if (task.endDate) {
    const end = new Date(task.endDate);
    if (!Number.isNaN(end.getTime()) && end < today) {
      daysOverdue = Math.max(1, Math.round((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24)));
    }
  } else if (task.startDate) {
    const start = new Date(task.startDate);
    if (!Number.isNaN(start.getTime()) && start < today && (task.progress ?? 0) === 0) {
      daysOverdue = Math.max(1, Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }
  if (task.delayDays && task.delayDays > 0) {
    daysOverdue = Math.max(daysOverdue, task.delayDays);
  }

  const label =
    (task.progress ?? 0) === 0
      ? `0% Progress · ${daysOverdue > 0 ? `${daysOverdue}d Overdue` : "Delayed"}`
      : `${task.progress}% · ${daysOverdue > 0 ? `${daysOverdue}d Overdue` : "Delayed"}`;

  return { isDelayed: true, daysOverdue, label };
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
}

function getTaskStatusConfig(task: ApiTask) {
  if (isTaskDelayed(task)) {
    return STATUS_CONFIG.delayed;
  }
  return getStatusConfig(task.status);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTaskDates(start?: string | null, end?: string | null): string {
  if (!start || !end) return "No dates set";
  try {
    const s = new Date(start);
    const e = new Date(end);
    const sDay = String(s.getDate()).padStart(2, "0");
    const sMon = s.toLocaleDateString("en-US", { month: "short" });
    const eDay = String(e.getDate()).padStart(2, "0");
    const eMon = e.toLocaleDateString("en-US", { month: "short" });
    return `${sDay} ${sMon} - ${eDay} ${eMon}`;
  } catch {
    return `${start} - ${end}`;
  }
}

function getTaskInitials(title: string): string {
  if (!title) return "TS";
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
}

// Progress overview dialog
function TaskProgressDialog({ task, onClose }: { task: ApiTask | null; onClose: () => void }) {
  if (!task) return null;

  const isDelayed = isTaskDelayed(task);
  const delayInfo = getTaskDelayInfo(task);
  const config = getTaskStatusConfig(task);
  const progress = clamp(task.progress ?? 0, 0, 100);

  const donutData = [
    { name: "Completed", value: progress },
    { name: "Remaining", value: 100 - progress },
  ];

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 border-slate-200/80 dark:border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              {config.label}
            </span>
            {isDelayed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm shadow-red-500/40">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                {delayInfo.daysOverdue > 0 ? `${delayInfo.daysOverdue}d Overdue` : "Delayed"}
              </span>
            )}
            {task.criticalPath && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-500/40">
                <Flame className="w-3.5 h-3.5" />
                Critical Path
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {task.department || "General"}
            </Badge>
          </div>
          <DialogTitle className="font-display text-xl sm:text-2xl font-bold text-foreground">{task.title}</DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            {task.startDate && task.endDate ? (
              <span>
                <strong className="text-foreground">{task.startDate}</strong> to <strong className="text-foreground">{task.endDate}</strong>
              </span>
            ) : (
              <span className="italic">No start or end dates assigned</span>
            )}
          </p>

          {isDelayed && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/50 flex items-start gap-2.5 text-left">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-red-600 dark:text-red-400">Delayed / Overdue Alert</p>
                <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed">
                  {(task.progress ?? 0) === 0
                    ? `Task schedule was from ${task.startDate || "start"} to ${task.endDate || "target end"}, but 0% progress has been completed. This work requires attention.`
                    : `Target deadline was ${task.endDate || "end date"} with only ${task.progress}% completion. Running behind schedule.`}
                </p>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-3">
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center">
            <h4 className="text-sm font-semibold mb-1 text-center flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Task Completion
            </h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill={config.chartColor} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-3xl font-extrabold text-foreground -mt-3">{progress}%</p>
            <p className="text-center text-xs font-medium text-muted-foreground">completed</p>
          </div>

          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" /> Schedule Details
              </h4>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground font-medium">Scheduled Window:</span>
                  <span className="font-bold text-foreground">{formatTaskDates(task.startDate, task.endDate)}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <span className="font-bold capitalize text-foreground">{task.status.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground font-medium">Priority:</span>
                  <span className="font-bold capitalize text-foreground">{task.priority || "Medium"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Timeline Component
// ============================================================================

const Timeline = () => {
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [colorBy, setColorBy] = useState<"status" | "department">("status");
  const [timeframe, setTimeframe] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [viewMode, setViewMode] = useState<"gantt" | "timeline" | "list">("gantt");
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);

  // Month & Year state (Default: October 2026, month index 9)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(9);
  const [selectedYear, setSelectedYear] = useState(2026);

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErrorObj,
  } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  const {
    data: apiTasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  const isLoading = projectsLoading || tasksLoading;
  const isError = projectsError || tasksError;
  const error = projectsErrorObj || tasksErrorObj;

  const activeProjects = useMemo(
    () => projects.filter((p: ApiProject) => !(p as unknown as { deleted?: boolean }).deleted),
    [projects]
  );

  // Merge canonical baseline tasks with any custom tasks created in database
  const combinedTasks = useMemo(() => {
    const customValid = apiTasks
      .map((t: any) => ({
        ...t,
        criticalPath: Boolean(t.criticalPath ?? t.critical_path ?? false),
      }))
      .filter(
        (t) =>
          t.startDate &&
          t.endDate &&
          !DEFAULT_TIMELINE_TASKS.some(
            (d) => d.id === t.id || d.title?.toLowerCase() === t.title?.toLowerCase()
          )
      );
    return [...DEFAULT_TIMELINE_TASKS, ...customValid];
  }, [apiTasks]);

  // Filter tasks based on search, project and status
  const filteredTasks = useMemo(() => {
    return combinedTasks.filter((t: ApiTask) => {
      if (projectFilter !== "all" && t.projectId !== Number(projectFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDept = t.department?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDept) return false;
      }
      if (statusFilter === "delayed") {
        return isTaskDelayed(t) || t.status === "delayed" || t.status === "blocked";
      }
      if (statusFilter === "completed") {
        return t.status === "completed";
      }
      if (statusFilter === "in_progress") {
        return t.status === "in_progress" && !isTaskDelayed(t);
      }
      if (statusFilter === "not_started") {
        return t.status === "not_started" && !isTaskDelayed(t);
      }
      if (statusFilter === "critical") {
        return Boolean(t.criticalPath || (t as any).critical_path);
      }
      return true;
    });
  }, [combinedTasks, projectFilter, searchQuery, statusFilter]);

  // KPI Metrics calculated dynamically from actual active tasks
  const metrics = useMemo(() => {
    const tasksToAnalyze =
      projectFilter === "all"
        ? combinedTasks
        : combinedTasks.filter((t) => t.projectId === Number(projectFilter));

    const total = tasksToAnalyze.length;
    const completed = tasksToAnalyze.filter((t) => t.status === "completed").length;
    const delayed = tasksToAnalyze.filter(
      (t) => isTaskDelayed(t) || t.status === "delayed" || t.status === "blocked"
    ).length;
    const inProgress = tasksToAnalyze.filter(
      (t) => t.status === "in_progress" && !isTaskDelayed(t)
    ).length;
    const critical = tasksToAnalyze.filter(
      (t) => Boolean(t.criticalPath || (t as any).critical_path)
    ).length;
    const avgProgress =
      total > 0
        ? Math.round(
            tasksToAnalyze.reduce((acc, t) => acc + (t.progress || 0), 0) / total
          )
        : 0;

    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const delayedPct = total > 0 ? Math.round((delayed / total) * 100) : 0;
    const criticalPct = total > 0 ? Math.round((critical / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      delayed,
      critical,
      avgProgress,
      completedPct,
      inProgressPct,
      delayedPct,
      criticalPct,
    };
  }, [combinedTasks, projectFilter]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonthIndex((m) => m + 1);
    }
  };

  const handleResetToday = () => {
    setSelectedMonthIndex(9);
    setSelectedYear(2026);
  };

  // Dynamic month days & range text
  const currentMonthName = MONTH_NAMES[selectedMonthIndex];
  const currentMonthShort = MONTH_SHORT[selectedMonthIndex];
  const daysInCurrentMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const dateRangeStr = `01 ${currentMonthShort} - ${daysInCurrentMonth} ${currentMonthShort}`;

  // 5 Weekly columns for the selected month
  const timelineWeeks = useMemo(() => {
    const isOct2026 = selectedYear === 2026 && selectedMonthIndex === 9;
    return [
      { label: `${currentMonthShort} 1`, sub: "Week 1", dayStart: 1, dayEnd: 7 },
      { label: `${currentMonthShort} 8`, sub: "Week 2", dayStart: 8, dayEnd: 14, isTodayCol: isOct2026 },
      { label: `${currentMonthShort} 15`, sub: "Week 3", dayStart: 15, dayEnd: 21 },
      { label: `${currentMonthShort} 22`, sub: "Week 4", dayStart: 22, dayEnd: 28 },
      { label: `${currentMonthShort} 29`, sub: "Week 5", dayStart: 29, dayEnd: daysInCurrentMonth },
    ];
  }, [selectedYear, selectedMonthIndex, currentMonthShort, daysInCurrentMonth]);

  // Grid width: 5 columns * 135px = 675px
  const gridWidth = 675;

  // Calculate task coordinates within the selected month
  const getTaskBarCoords = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate || !endDate) return { left: 0, width: 60 };
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);

      // Determine task span in this month
      const startDay = clamp(s.getDate(), 1, daysInCurrentMonth);
      const endDay = clamp(e.getDate(), 1, daysInCurrentMonth);

      const left = ((startDay - 1) / daysInCurrentMonth) * gridWidth;
      const width = Math.max(34, ((endDay - startDay + 1) / daysInCurrentMonth) * gridWidth);
      return { left, width };
    } catch {
      return { left: 0, width: 60 };
    }
  };

  // Helper to construct static, clean, orthogonal dependency paths
  // Connects parent bar right endpoint (x1, y1) directly to dependent bar start endpoint (x2, y2)
  const getGanttConnectorPath = (x1: number, y1: number, x2: number, y2: number, channelY?: number) => {
    // Forward dependency with room:
    if (x2 >= x1 + 14) {
      const xMid = Math.round(x1 + (x2 - x1) / 2);
      return `M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`;
    }

    // Overlapping or backwards horizontal alignment:
    const xRight = Math.round(x1 + 8);
    const yMid = channelY !== undefined ? channelY : Math.round(y1 + (y2 - y1) / 2);
    const xLeft = Math.round(x2 - 8);

    return `M ${x1} ${y1} H ${xRight} V ${yMid} H ${xLeft} V ${y2} H ${x2}`;
  };

  // Coordinates for dependency arrows
  const coordsTask0 = getTaskBarCoords("2026-10-01", "2026-10-10");
  const coordsTask1 = getTaskBarCoords("2026-10-05", "2026-10-25");
  const coordsTask3 = getTaskBarCoords("2026-10-25", "2026-10-31");

  const rowHeight = 54;
  const xEnd0 = Math.round(coordsTask0.left + coordsTask0.width);
  const xStart1 = Math.round(coordsTask1.left);
  const xEnd1 = Math.round(coordsTask1.left + coordsTask1.width);
  const xStart3 = Math.round(coordsTask3.left);

  // Arrow 1: Design Phase (row 0, y=27) -> Development (row 1, y=81)
  const arrow1Path = getGanttConnectorPath(xEnd0, 27, xStart1, 27 + rowHeight, 54);

  // Arrow 2: Development (row 1, y=81) -> Deployment (row 3, y=189)
  const arrow2Path = getGanttConnectorPath(xEnd1, 27 + rowHeight, xStart3, 27 + rowHeight * 3, 162);

  // Today marker at Oct 8 (only active when Oct 2026 is selected)
  const isTodayActive = selectedYear === 2026 && selectedMonthIndex === 9;
  const todayPositionPx = ((8 - 1 + 0.3) / daysInCurrentMonth) * gridWidth;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium text-sm">Loading project schedule & timeline…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-destructive/10 border border-destructive/30 rounded-2xl">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h3 className="text-lg font-bold text-destructive">Couldn't Load Timeline</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof ApiError ? error.message : "Unable to reach the backend service."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* 1. TOP HEADER (Add Task removed as requested) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 flex items-center justify-center text-white shrink-0">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Project Timeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Interactive Gantt roadmap with real-time progress and variance tracking
            </p>
          </div>
        </div>

        {/* Right: Interactive Month Navigation Pill Card */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 bg-white dark:bg-card border border-slate-200/90 dark:border-border rounded-2xl px-4 py-2 shadow-xs">
            <Calendar className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex flex-col text-left hover:opacity-80 transition-opacity">
                  <span className="font-bold text-sm text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                    {currentMonthName} {selectedYear}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium leading-tight">
                    {dateRangeStr}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 max-h-60 overflow-y-auto">
                {MONTH_NAMES.map((m, idx) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setSelectedMonthIndex(idx)}
                    className={selectedMonthIndex === idx ? "font-bold text-blue-600" : ""}
                  >
                    {m} {selectedYear}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-muted flex items-center justify-center text-slate-500 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-muted flex items-center justify-center text-slate-500 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & VIEW CONTROLS ROW */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search tasks, milestones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-10 rounded-xl bg-white dark:bg-card border-slate-200/90 dark:border-border text-xs sm:text-sm font-normal shadow-xs focus-visible:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project Dropdown */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[145px] sm:w-[155px] h-10 rounded-xl bg-white dark:bg-card border-slate-200/90 dark:border-border shadow-xs text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <Folder className="w-4 h-4 text-slate-500 shrink-0" />
                <SelectValue placeholder="All Projects" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {activeProjects.map((p: ApiProject) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Dropdown */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[135px] sm:w-[145px] h-10 rounded-xl bg-white dark:bg-card border-slate-200/90 dark:border-border shadow-xs text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <Activity className="w-4 h-4 text-slate-500 shrink-0" />
                <SelectValue placeholder="All Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="delayed" className="text-red-600 font-semibold">Delayed / Overdue</SelectItem>
              <SelectItem value="critical" className="text-purple-600 font-semibold">Critical Path</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
            </SelectContent>
          </Select>

          {/* By Status / Department Dropdown */}
          <Select value={colorBy} onValueChange={(v: "status" | "department") => setColorBy(v)}>
            <SelectTrigger className="w-[130px] sm:w-[140px] h-10 rounded-xl bg-white dark:bg-card border-slate-200/90 dark:border-border shadow-xs text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">By Status</SelectItem>
              <SelectItem value="department">By Department</SelectItem>
            </SelectContent>
          </Select>

          {/* Timeframe Dropdown */}
          <Select value={timeframe} onValueChange={(v: "monthly" | "weekly" | "daily") => setTimeframe(v)}>
            <SelectTrigger className="w-[125px] sm:w-[135px] h-10 rounded-xl bg-white dark:bg-card border-slate-200/90 dark:border-border shadow-xs text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Switcher: Gantt | Timeline | List */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-muted rounded-xl border border-slate-200/70 dark:border-border shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("gantt")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "gantt"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Gantt
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "timeline"
                ? "bg-blue-600 text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "list"
                ? "bg-blue-600 text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* 3. FIVE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
        <Card
          className={`rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow transition-all overflow-hidden cursor-pointer ${
            statusFilter === "all" ? "ring-2 ring-blue-500/50 bg-blue-50/10 dark:bg-blue-950/20" : ""
          }`}
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Total Tasks</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">{metrics.total}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{metrics.avgProgress}% avg. progress</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-7 text-blue-500 shrink-0 ml-1">
              <div className="w-1.5 h-2.5 bg-blue-500/40 rounded-xs" />
              <div className="w-1.5 h-5 bg-blue-500/70 rounded-xs" />
              <div className="w-1.5 h-7 bg-blue-500 rounded-xs" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow transition-all overflow-hidden cursor-pointer ${
            statusFilter === "completed" ? "ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20" : ""
          }`}
          onClick={() => setStatusFilter((curr) => (curr === "completed" ? "all" : "completed"))}
        >
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Completed</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">{metrics.completed}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{metrics.completedPct}% of total</p>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 relative flex items-center justify-center ml-1">
              <svg className="w-7.5 h-7.5 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-muted stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${metrics.completedPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow transition-all overflow-hidden cursor-pointer ${
            statusFilter === "in_progress" ? "ring-2 ring-amber-500 bg-amber-50/20 dark:bg-amber-950/20" : ""
          }`}
          onClick={() => setStatusFilter((curr) => (curr === "in_progress" ? "all" : "in_progress"))}
        >
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">In Progress</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 leading-tight mt-0.5">{metrics.inProgress}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">{metrics.inProgressPct}% of total</p>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 relative flex items-center justify-center ml-1">
              <svg className="w-7.5 h-7.5 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-muted stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-500 stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${metrics.inProgressPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl border-red-200/80 dark:border-red-900/50 bg-gradient-to-br from-white via-red-50/25 to-red-100/40 dark:from-card dark:to-red-950/20 shadow-xs hover:shadow transition-all overflow-hidden cursor-pointer ${
            statusFilter === "delayed" ? "ring-2 ring-red-500 bg-red-50/30 dark:bg-red-950/30" : ""
          }`}
          onClick={() => setStatusFilter((curr) => (curr === "delayed" ? "all" : "delayed"))}
        >
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400 truncate">Delayed / Risk</p>
                <p className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 leading-tight mt-0.5">{metrics.delayed}</p>
                <p className="text-[10px] sm:text-[11px] text-red-500 font-bold leading-tight mt-0.5 truncate">Needs Action</p>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 relative flex items-center justify-center ml-1">
              <svg className="w-7.5 h-7.5 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-red-100 dark:text-red-950/40 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-red-500 stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${metrics.delayedPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-xs hover:shadow transition-all overflow-hidden cursor-pointer ${
            statusFilter === "critical" ? "ring-2 ring-purple-500 bg-purple-50/20 dark:bg-purple-950/20" : ""
          }`}
          onClick={() => setStatusFilter((curr) => (curr === "critical" ? "all" : "critical"))}
        >
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Critical Path</p>
                <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 leading-tight mt-0.5">{metrics.critical}</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">Dependencies</p>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 relative flex items-center justify-center ml-1">
              <svg className="w-7.5 h-7.5 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-muted stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-purple-500 stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${metrics.criticalPct}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. MAIN CONTAINER: SWITCHABLE BETWEEN GANTT, TIMELINE & LIST */}
      {viewMode === "gantt" && (
        <Card className="rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-sm overflow-hidden">
          {/* Card Header Bar */}
          <div className="p-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-border/80 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <ListTree className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Project Timeline (Gantt View)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToday}
                className="h-8 px-3 rounded-lg border-slate-200 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                Today
              </Button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                <SelectTrigger className="h-8 w-[100px] text-xs font-medium border-slate-200 dark:border-border rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>

              <button
                type="button"
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted flex items-center justify-center text-slate-600 dark:text-slate-300"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Container with Sticky Left Column & Right Gantt Chart */}
          <div className="overflow-x-auto">
            <div className="min-w-[1040px] flex flex-col">
              {/* Header Row */}
              <div className="flex border-b border-slate-200/80 dark:border-border/80 bg-slate-50/50 dark:bg-muted/30 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {/* Sticky Left Table Header (Never gets clipped on scroll) */}
                <div className="w-[380px] shrink-0 sticky left-0 z-30 bg-slate-50/95 dark:bg-card/95 backdrop-blur flex items-center border-r border-slate-200/80 dark:border-border/80 py-3 px-4 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                  <div className="w-[155px] shrink-0 font-semibold">Task</div>
                  <div className="w-[105px] shrink-0 font-semibold">Progress</div>
                  <div className="w-[90px] shrink-0 font-semibold">Dates</div>
                  <div className="w-[30px] shrink-0"></div>
                </div>

                {/* Right Timeline Weeks Header */}
                <div className="flex-1 flex relative" style={{ minWidth: gridWidth }}>
                  {timelineWeeks.map((week) => (
                    <div
                      key={week.label}
                      className="flex-1 text-center py-2 px-1 relative border-r border-slate-100 dark:border-border/40"
                    >
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{week.label}</p>
                      <p className="text-[11px] font-medium text-slate-400">{week.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows Grid */}
              <div className="relative">
                {/* Scrollable Rows */}
                {filteredTasks.map((task, index) => {
                  const isDelayed = isTaskDelayed(task);
                  const config = getTaskStatusConfig(task);
                  const { left, width } = getTaskBarCoords(task.startDate, task.endDate);
                  const initials = getTaskInitials(task.title);

                  const progressBarColor =
                    task.status === "completed"
                      ? "bg-emerald-500"
                      : isDelayed
                      ? "bg-red-500"
                      : task.status === "in_progress"
                      ? "bg-amber-500"
                      : "bg-blue-500";

                  return (
                    <div
                      key={task.id}
                      className="flex border-b border-slate-100 dark:border-border/40 hover:bg-slate-50/60 dark:hover:bg-muted/20 transition-colors h-[54px] items-center"
                    >
                      {/* Sticky Left Task Column (Always visible, cannot be scrolled off) */}
                      <div className="w-[380px] shrink-0 sticky left-0 z-20 bg-white dark:bg-card flex items-center border-r border-slate-200/80 dark:border-border/80 px-4 h-full shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                        {/* Task Name */}
                        <div className="w-[155px] shrink-0 flex items-center gap-2 pr-2">
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor} shrink-0`} />
                          <span
                            className="text-xs font-semibold text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-600 transition-colors"
                            title={task.title}
                            onClick={() => setSelectedTask(task)}
                          >
                            {task.title}
                          </span>
                        </div>

                        {/* Progress Bar & Percentage */}
                        <div className="w-[105px] shrink-0 flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8">
                            {task.progress ?? 0}%
                          </span>
                          <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressBarColor}`}
                              style={{ width: `${task.progress ?? 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="w-[90px] shrink-0 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatTaskDates(task.startDate, task.endDate)}
                        </div>

                        {/* Action Menu */}
                        <div className="w-[30px] shrink-0 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                                View Variance Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                                Progress Overview
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Right Gantt Bar Chart Cell */}
                      <div className="flex-1 relative h-full flex items-center" style={{ minWidth: gridWidth }}>
                        {/* Background Grid Columns */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {timelineWeeks.map((week) => (
                            <div
                              key={week.label}
                              className="flex-1 border-r border-slate-100 dark:border-border/30 h-full"
                            />
                          ))}
                        </div>

                        {/* Gantt Bar Pill */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute h-7.5 rounded-full cursor-pointer ${config.gradient} ${config.glow} transition-all duration-200 hover:brightness-105 flex items-center justify-end pr-1 z-20`}
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                              }}
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-full pointer-events-none" />

                              {/* End Cap Badge: Initials + Status Icon */}
                              <div className="flex items-center gap-1 relative z-10 shrink-0">
                                <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                                  {initials}
                                </span>
                                {task.status === "completed" ? (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </span>
                                ) : isDelayed ? (
                                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-xs">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                  </span>
                                ) : (
                                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-slate-600">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="p-3 max-w-xs shadow-xl border-slate-200">
                            <div className="space-y-1">
                              <p className="font-bold text-xs text-foreground">{task.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatTaskDates(task.startDate, task.endDate)}
                              </p>
                              <p className="text-[11px] font-semibold text-blue-600">
                                {task.progress ?? 0}% Completed · {config.label}
                              </p>
                              {isDelayed && (
                                <p className="text-[10px] text-red-600 font-bold">
                                  ⚠️ Task is overdue or behind schedule
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}

                {/* SVG Dependency Lines with Clear, Static, Straight Orthogonal Connectors */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{ left: 380, right: 0 }}
                >
                  <svg className="w-full h-full overflow-visible pointer-events-none">
                    <defs>
                      <marker
                        id="gantt-arrowhead"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto"
                      >
                        <polygon points="0 1, 7 4, 0 7" fill="#475569" />
                      </marker>
                    </defs>

                    {/* Arrow 1: Static, straight orthogonal connector from Design Phase end directly to Development start */}
                    <path
                      d={arrow1Path}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.8"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      markerEnd="url(#gantt-arrowhead)"
                    />

                    {/* Arrow 2: Static, straight orthogonal connector from Development end directly to Deployment start */}
                    <path
                      d={arrow2Path}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.8"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      markerEnd="url(#gantt-arrowhead)"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 5. BOTTOM STATUS LEGEND BAR */}
          <div className="p-3 sm:px-6 bg-slate-50/40 dark:bg-muted/10 border-t border-slate-200/80 dark:border-border/80 flex items-center justify-between text-xs flex-wrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 shrink-0">
                <ListTree className="w-4 h-4 text-blue-600" />
                <span>Status Legend:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded-full font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Delayed / Overdue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Blocked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Ready</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Not Started</span>
                </div>
                <div className="flex items-center gap-1 bg-rose-500 text-white px-2 py-0.5 rounded-md font-bold text-[10px]">
                  ⚡ CP Critical Path
                </div>
              </div>
            </div>

            <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 italic text-[11px]">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Click any bar to view variance details</span>
            </div>
          </div>
        </Card>
      )}

      {/* 5. TIMELINE STREAM VIEW (Active when viewMode === "timeline") */}
      {viewMode === "timeline" && (
        <Card className="rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-sm p-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-200/80 dark:border-border/80 mb-6">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Chronological Milestone Timeline
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Showing {filteredTasks.length} milestones for {currentMonthName} {selectedYear}
            </span>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-8 my-2">
            {filteredTasks.map((task) => {
              const isDelayed = isTaskDelayed(task);
              const config = getTaskStatusConfig(task);
              const progress = clamp(task.progress ?? 0, 0, 100);

              return (
                <div key={task.id} className="relative group">
                  {/* Node Dot on Timeline Spine */}
                  <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-5 h-5 rounded-full border-4 border-white dark:border-card ${config.dotColor} shadow-md flex items-center justify-center`} />

                  {/* Milestone Card */}
                  <div
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-border/80 bg-slate-50/50 dark:bg-muted/20 hover:border-blue-400/80 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                          {task.title}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeBg}`}>
                          {config.label}
                        </span>
                        {isDelayed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                        {task.criticalPath && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                            <Flame className="w-3 h-3" /> Critical Path
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        {formatTaskDates(task.startDate, task.endDate)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                      {task.description || "Project milestone phase"}
                    </p>

                    {/* Progress Bar & Details */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                          <span>Progress</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${config.gradient}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 h-8">
                        Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 6. LIST TABLE VIEW (Active when viewMode === "list") */}
      {viewMode === "list" && (
        <Card className="rounded-2xl border-slate-200/80 dark:border-border/80 bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-border/80">
            <div className="flex items-center gap-2.5">
              <List className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Task Roadmap List ({filteredTasks.length})
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Period: {currentMonthName} {selectedYear}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-muted/30 border-b border-slate-200/80 dark:border-border/80 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border/40">
                {filteredTasks.map((task) => {
                  const isDelayed = isTaskDelayed(task);
                  const config = getTaskStatusConfig(task);
                  const progress = clamp(task.progress ?? 0, 0, 100);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                        <span>{task.title}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {task.department || "General"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatTaskDates(task.startDate, task.endDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                          {task.priority || "Medium"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-8 font-medium">{progress}%</span>
                          <div className="w-20 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full ${config.gradient}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeBg}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-blue-600 hover:text-blue-700 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Progress Overview Modal Dialog */}
      <TaskProgressDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
};

export default Timeline;