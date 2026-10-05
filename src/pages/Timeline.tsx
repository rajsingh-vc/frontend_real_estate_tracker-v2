// Timeline.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Flame,
  Info, Layers, TrendingUp, Sparkles, AlertCircle
} from "lucide-react";
import { projectsApi, tasksApi, ApiError, type ApiProject, type ApiTask } from "@/lib/api";

// ============================================================================
// Timeline — Live API driven with vibrant modern colors & executive UX.
// Features:
//  1. Vibrant high-contrast gradient status bars with inner progress fills.
//  2. Live "Today" line marker indicating exact position of current date.
//  3. KPI summary cards at top for instant health & progress comprehension.
//  4. Interactive color legend explaining all visual cues and critical paths.
//  5. Enhanced Progress Overview dialog with rich Recharts metrics.
//  6. Filtered strictly to active/existing projects.
// ============================================================================

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const startYear = 2026;
const totalMonths = 30; // 2.5 years

// Bright, vibrant palette for Gantt bars, badges & charts
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
    gradient: "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500",
    border: "border-emerald-300/50",
    text: "text-white",
    glow: "shadow-md shadow-emerald-500/25",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    chartColor: "#10b981",
    dotColor: "bg-emerald-500",
  },
  in_progress: {
    label: "In Progress",
    gradient: "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500",
    border: "border-amber-200/50",
    text: "text-white",
    glow: "shadow-md shadow-amber-500/25",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    chartColor: "#f59e0b",
    dotColor: "bg-amber-500",
  },
  delayed: {
    label: "Delayed",
    gradient: "bg-gradient-to-r from-rose-500 via-red-500 to-pink-600",
    border: "border-rose-300/50",
    text: "text-white",
    glow: "shadow-md shadow-rose-500/30",
    badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    chartColor: "#f43f5e",
    dotColor: "bg-rose-500",
  },
  blocked: {
    label: "Blocked",
    gradient: "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600",
    border: "border-purple-300/40",
    text: "text-white",
    glow: "shadow-md shadow-purple-500/25",
    badgeBg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    chartColor: "#a855f7",
    dotColor: "bg-purple-500",
  },
  review: {
    label: "Review",
    gradient: "bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500",
    border: "border-indigo-300/40",
    text: "text-white",
    glow: "shadow-md shadow-indigo-500/25",
    badgeBg: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    chartColor: "#6366f1",
    dotColor: "bg-indigo-500",
  },
  ready: {
    label: "Ready",
    gradient: "bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-500",
    border: "border-cyan-200/40",
    text: "text-white",
    glow: "shadow-md shadow-cyan-500/25",
    badgeBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    chartColor: "#0ea5e9",
    dotColor: "bg-sky-500",
  },
  not_started: {
    label: "Not Started",
    gradient: "bg-gradient-to-r from-slate-400 to-slate-500",
    border: "border-slate-300/30",
    text: "text-white",
    glow: "shadow-sm shadow-slate-500/20",
    badgeBg: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    chartColor: "#94a3b8",
    dotColor: "bg-slate-400",
  },
};

const DEPARTMENT_BADGES: Record<string, string> = {
  Civil: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  Structure: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  Structural: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  Electrical: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800",
  Plumbing: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  MEP: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
  Finishing: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  "Fire Safety": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  Legal: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  Admin: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
}

function getMonthIndex(dateStr: string) {
  const d = new Date(dateStr);
  return (d.getFullYear() - startYear) * 12 + d.getMonth();
}

function daysBetween(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ============================================================================
// Progress overview dialog
// ============================================================================

function TaskProgressDialog({ task, onClose }: { task: ApiTask | null; onClose: () => void }) {
  if (!task) return null;

  const config = getStatusConfig(task.status);
  const progress = clamp(task.progress ?? 0, 0, 100);

  const totalDays = daysBetween(task.startDate, task.endDate);
  const elapsedDaysRaw = task.startDate ? daysBetween(task.startDate, new Date().toISOString()) : null;
  const hasSchedule = totalDays !== null && totalDays > 0 && elapsedDaysRaw !== null;
  const elapsedPct = hasSchedule ? clamp((elapsedDaysRaw! / totalDays!) * 100, 0, 100) : null;

  const donutData = [
    { name: "Completed", value: progress },
    { name: "Remaining", value: 100 - progress },
  ];

  const compareData = hasSchedule
    ? [
        { name: "Progress", value: Math.round(progress) },
        { name: "Time Elapsed", value: Math.round(elapsedPct!) },
      ]
    : [{ name: "Progress", value: Math.round(progress) }];

  const scheduleNote = hasSchedule
    ? progress >= elapsedPct!
      ? progress === elapsedPct!
        ? "On Track — progress matches scheduled time elapsed."
        : "Ahead of Schedule — task progress is running ahead of plan!"
      : "Behind Schedule — elapsed calendar days have outpaced current progress."
    : task.status === "completed"
      ? "Task is fully completed."
      : "Add a start and target end date to track timeline variance.";

  const scheduleColor = !hasSchedule
    ? "text-muted-foreground"
    : progress >= elapsedPct!
      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
      : "text-rose-600 dark:text-rose-400 font-semibold";

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-primary/20 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              {config.label}
            </span>
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
          <DialogTitle className="font-display text-2xl font-bold text-foreground">{task.title}</DialogTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {task.startDate && task.endDate ? (
              <span>
                <strong className="text-foreground">{task.startDate}</strong> to <strong className="text-foreground">{task.endDate}</strong>
              </span>
            ) : (
              <span className="italic">No start or end dates assigned</span>
            )}
          </p>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-3">
          {/* Donut: overall completion */}
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

          {/* Bar: progress vs time elapsed */}
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-center flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" /> Progress vs. Time Elapsed
              </h4>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <RechartsTooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {compareData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === "Progress" ? config.chartColor : "#f59e0b"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className={`text-center text-xs mt-2 p-2 rounded-lg bg-muted/40 ${scheduleColor}`}>{scheduleNote}</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center p-3 rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10">
            <p className="text-xs text-muted-foreground font-medium">Scheduled Duration</p>
            <p className="font-bold text-base text-foreground mt-0.5">{totalDays === null ? "—" : `${totalDays} Days`}</p>
          </div>
          <div className="text-center p-3 rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10">
            <p className="text-xs text-muted-foreground font-medium">Time Consumed</p>
            <p className="font-bold text-base text-foreground mt-0.5">{elapsedPct === null ? "—" : `${Math.round(elapsedPct)}%`}</p>
          </div>
          <div className="text-center p-3 rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10">
            <p className="text-xs text-muted-foreground font-medium">Task Priority</p>
            <p className="font-bold text-base capitalize mt-0.5 text-foreground">{task.priority || "Medium"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Timeline = () => {
  const [projectFilter, setProjectFilter] = useState("all");
  const [zoom, setZoom] = useState<"month" | "quarter">("month");
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErrorObj,
  } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  const isLoading = projectsLoading || tasksLoading;
  const isError = projectsError || tasksError;
  const error = projectsErrorObj || tasksErrorObj;

  // Show only active, non-deleted projects
  const activeProjects = useMemo(
    () => projects.filter((p: ApiProject) => !(p as unknown as { deleted?: boolean }).deleted),
    [projects]
  );

  const activeProjectIds = useMemo(
    () => new Set(activeProjects.map((p) => p.id)),
    [activeProjects]
  );

  // Filter tasks belonging strictly to active projects
  const filtered = useMemo(() => {
    return tasks.filter((t: ApiTask) => {
      // If task is bound to a project that was deleted/inactive, omit it
      if (t.projectId && !activeProjectIds.has(t.projectId)) {
        return false;
      }
      if (projectFilter === "all") return true;
      return t.projectId === Number(projectFilter);
    });
  }, [tasks, activeProjectIds, projectFilter]);

  // High-level KPI metrics for the timeline
  const metrics = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((t) => t.status === "completed").length;
    const inProgress = filtered.filter((t) => t.status === "in_progress").length;
    const delayed = filtered.filter((t) => t.status === "delayed" || t.status === "blocked").length;
    const critical = filtered.filter((t) => t.criticalPath).length;
    const avgProgress = total > 0 ? Math.round(filtered.reduce((acc, t) => acc + (t.progress || 0), 0) / total) : 0;

    return { total, completed, inProgress, delayed, critical, avgProgress };
  }, [filtered]);

  const colWidth = zoom === "month" ? 85 : 250;

  const headerCols =
    zoom === "month"
      ? Array.from({ length: totalMonths }, (_, i) => {
          const m = i % 12;
          const y = startYear + Math.floor(i / 12);
          return { label: months[m], sub: y.toString(), key: `${y}-${m}` };
        })
      : Array.from({ length: Math.ceil(totalMonths / 3) }, (_, i) => {
          const q = (i % 4) + 1;
          const y = startYear + Math.floor(i / 4);
          return { label: `Q${q}`, sub: y.toString(), key: `${y}-Q${q}` };
        });

  // Calculate "Today" indicator position (supports current date in 2026/2027)
  const todayPosition = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();
    const monthDiff = (curYear - startYear) * 12 + curMonth;

    if (monthDiff < 0 || monthDiff >= totalMonths) {
      return null;
    }

    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const fraction = curDate / daysInMonth;
    const px = zoom === "month"
      ? (monthDiff + fraction) * colWidth
      : ((monthDiff + fraction) / 3) * colWidth;

    return {
      leftPx: px,
      dateLabel: `${months[curMonth]} ${curDate}, ${curYear}`,
    };
  }, [zoom, colWidth]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
          {error instanceof ApiError ? error.message : "Unable to reach the backend service. Please verify server connection."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Main Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Calendar className="w-6 h-6 text-primary" />
            </span>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Project Timeline</h1>
              <p className="text-sm text-muted-foreground">Interactive Gantt roadmap with real-time progress & variance tracking</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">Project:</span>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[190px] h-10 bg-card border-border/80 shadow-sm font-medium">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌐 All Projects</SelectItem>
                {activeProjects.map((p: ApiProject) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    🏢 {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zoom view toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">Zoom:</span>
            <Select value={zoom} onValueChange={(v: "month" | "quarter") => setZoom(v)}>
              <SelectTrigger className="w-[125px] h-10 bg-card border-border/80 shadow-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">📅 Monthly</SelectItem>
                <SelectItem value="quarter">📊 Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <Card className="border-border/60 bg-gradient-to-br from-card to-blue-500/5 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Tasks</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{metrics.total}</span>
              <span className="text-xs font-semibold text-primary">{metrics.avgProgress}% avg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/10 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.completed}</span>
              <span className="text-xs text-muted-foreground font-medium">
                {metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/10 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">In Progress</span>
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.inProgress}</span>
              <span className="text-xs text-muted-foreground font-medium">Active</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-gradient-to-br from-card via-card to-rose-500/10 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Delayed / At Risk</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.delayed}</span>
              <span className="text-xs text-rose-500 font-semibold">Needs Action</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-500/10 shadow-sm hover:shadow transition-shadow col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Critical Path</span>
              <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{metrics.critical}</span>
              <span className="text-xs text-muted-foreground font-medium">Dependencies</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bright, User-Friendly Color Legend Bar */}
      <div className="bg-card border border-border/80 rounded-xl p-3 px-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Status Legend:</span>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([key, item]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded-full ${item.dotColor} shadow-sm`} />
              <span className="font-semibold text-foreground/85">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pl-2 border-l border-border">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-500 text-white shadow-xs">
              ⚡ CP
            </span>
            <span className="font-semibold text-foreground/85">Critical Path</span>
          </div>
          {todayPosition && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
              <span className="font-bold text-rose-600 dark:text-rose-400">Today Marker</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1 italic">
          <Info className="w-3.5 h-3.5 text-primary" />
          <span>Click any bar to view progress & schedule comparison</span>
        </div>
      </div>

      {/* Main Gantt Timeline View */}
      <Card className="border-border/80 shadow-md overflow-hidden bg-card">
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-20 px-4">
              <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">No tasks to display</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                No tasks are currently scheduled for the selected project filter.
              </p>
            </div>
          ) : (
            <div className="min-w-[900px] select-none">
              {/* Header */}
              <div className="flex border-b border-border/80 sticky top-0 bg-card/95 backdrop-blur z-20 shadow-xs">
                <div className="w-[280px] shrink-0 p-3.5 font-bold text-xs uppercase tracking-wider text-muted-foreground border-r bg-muted/20">
                  Task & Details
                </div>
                <div className="flex relative">
                  {headerCols.map((col) => (
                    <div
                      key={col.key}
                      className="text-center border-r border-border/50 py-2.5 px-1 shrink-0 bg-muted/10 transition-colors hover:bg-muted/30"
                      style={{ width: colWidth }}
                    >
                      <p className="text-xs font-bold text-foreground">{col.label}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{col.sub}</p>
                    </div>
                  ))}

                  {/* "Today" Pin in Header */}
                  {todayPosition && (
                    <div
                      className="absolute top-1 -translate-x-1/2 z-30 pointer-events-none"
                      style={{ left: todayPosition.leftPx }}
                    >
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-md shadow-rose-500/40 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Today
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Full-height "Today" line marker through all rows */}
                {todayPosition && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-10"
                    style={{ left: 280 + todayPosition.leftPx }}
                  >
                    <div className="w-0.5 h-full bg-rose-500 border-l-2 border-dashed border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                  </div>
                )}

                {filtered.map((task: ApiTask, index: number) => {
                  const config = getStatusConfig(task.status);
                  const deptBadge = DEPARTMENT_BADGES[task.department] || "bg-muted/50 text-foreground border-border";

                  // Handle tasks without start and end dates
                  if (!task.startDate || !task.endDate) {
                    return (
                      <div
                        key={task.id}
                        className={`flex border-b border-border/50 hover:bg-muted/25 transition-colors ${
                          index % 2 === 0 ? "bg-card" : "bg-muted/5"
                        }`}
                      >
                        <div className="w-[280px] shrink-0 p-3 border-r border-border/60">
                          <p className="text-sm font-semibold truncate text-foreground">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${deptBadge}`}>
                              {task.department || "General"}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
                              {config.label}
                            </span>
                          </div>
                        </div>
                        <div
                          className="flex-1 relative flex items-center px-4 cursor-pointer group"
                          style={{ minWidth: headerCols.length * colWidth }}
                          onClick={() => setSelectedTask(task)}
                        >
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-colors">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>No dates set · Click to configure</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const startIdx = getMonthIndex(task.startDate);
                  const endIdx = getMonthIndex(task.endDate);
                  const duration = Math.max(1, endIdx - startIdx + 1);
                  const leftPx = zoom === "month" ? startIdx * colWidth : (startIdx / 3) * colWidth;
                  const widthPx = zoom === "month" ? duration * colWidth - 6 : (duration / 3) * colWidth - 6;

                  const isCritical = task.criticalPath;
                  const progressValue = clamp(task.progress || 0, 0, 100);

                  return (
                    <div
                      key={task.id}
                      className={`flex border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        index % 2 === 0 ? "bg-card" : "bg-muted/5"
                      }`}
                    >
                      {/* Left Task Column */}
                      <div className="w-[280px] shrink-0 p-3 border-r border-border/60 flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold truncate text-foreground" title={task.title}>
                            {task.title}
                          </p>
                          {isCritical && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white shadow-xs">
                              <Flame className="w-2.5 h-2.5" /> CP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${deptBadge}`}>
                            {task.department || "General"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
                            {config.label}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                            {progressValue}%
                          </span>
                        </div>
                      </div>

                      {/* Right Gantt Chart Grid Column */}
                      <div className="flex-1 relative h-14" style={{ minWidth: headerCols.length * colWidth }}>
                        {/* Background vertical column lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {headerCols.map((col) => (
                            <div
                              key={col.key}
                              className="border-r border-border/40 h-full shrink-0"
                              style={{ width: colWidth }}
                            />
                          ))}
                        </div>

                        {/* Interactive Gantt Bar with bright modern styling */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-3 h-8 rounded-lg cursor-pointer ${config.gradient} ${config.border} ${config.glow} transition-all duration-200 hover:scale-[1.01] hover:brightness-110 flex items-center overflow-hidden px-2 z-10 ${
                                isCritical ? "ring-2 ring-rose-500/80 ring-offset-1" : ""
                              }`}
                              style={{
                                left: Math.max(leftPx + 3, 2),
                                width: Math.max(widthPx, 24),
                              }}
                              onClick={() => setSelectedTask(task)}
                            >
                              {/* Inner progress fill overlay */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-white/20 pointer-events-none transition-all duration-500"
                                style={{ width: `${progressValue}%` }}
                              />

                              {/* Subtle glass reflection highlight */}
                              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

                              {/* Content inside bar */}
                              <div className="relative z-10 flex items-center justify-between w-full text-white drop-shadow-sm font-semibold text-xs truncate">
                                {widthPx >= 90 ? (
                                  <>
                                    <span className="truncate pr-1 text-[11px] font-bold">{task.title}</span>
                                    <span className="text-[10px] font-extrabold bg-black/25 px-1.5 py-0.5 rounded-md shrink-0">
                                      {progressValue}%
                                    </span>
                                  </>
                                ) : widthPx >= 45 ? (
                                  <span className="text-[10px] font-extrabold mx-auto">{progressValue}%</span>
                                ) : null}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="p-3 max-w-xs shadow-xl border-border/80">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                                <p className="font-bold text-sm text-foreground">{task.title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span>{task.startDate} → {task.endDate}</span>
                              </p>
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                                <span className="font-semibold text-foreground">{config.label}</span>
                                <span className="font-extrabold text-primary">{progressValue}% Done</span>
                              </div>
                              {task.criticalPath && (
                                <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                                  <Flame className="w-3 h-3" /> Critical Path Item
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground italic pt-1">
                                Click to inspect full progress overview & variance
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>

                        {/* Dependency line preview */}
                        {task.dependencies && task.dependencies.length > 0 && (
                          <div
                            className="absolute top-7 h-0.5 bg-primary/40 pointer-events-none rounded-full"
                            style={{ left: 0, width: Math.max(leftPx, 0) }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Overview Modal Dialog */}
      <TaskProgressDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
};

export default Timeline;