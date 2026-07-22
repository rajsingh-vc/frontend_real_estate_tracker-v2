// Timeline.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { statusLabels } from "@/data/demo-data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from "recharts";
import { projectsApi, tasksApi, ApiError, type ApiProject, type ApiTask } from "@/lib/api";

// ============================================================================
// Timeline — now driven by live API data instead of demo-data.
//
// Two things the demo data never had to deal with, that real tasks do:
//  1. `projectId` on ApiTask is a number, not the demo data's string id — the
//     project filter/select values are stringified to match <Select>'s API,
//     then compared back as numbers.
//  2. `startDate`/`endDate` can be null (a task may not have dates set yet).
//     Those tasks still show up as a row (so nothing "disappears" from the
//     timeline) but render a "No dates set" note instead of a Gantt bar.
//
// Reads the same ["projects"] / ["tasks"] query keys as every other page, so
// anything created manually or via PDF/document bulk import appears here
// once those queries are invalidated.
//
// ✅ NEW: clicking a Gantt bar opens a "Progress Overview" dialog for that
// task — a donut chart (how much of the task is done) plus a bar chart
// comparing % Progress against % of the scheduled time that has elapsed,
// so it's immediately clear whether a task is on track, ahead, or behind
// schedule instead of just showing a bar and a tooltip.
// ============================================================================

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const startYear = 2026;
const totalMonths = 30; // 2.5 years – adjust as needed

// Chart colors pull from the same CSS custom properties the rest of the app
// uses for status badges (bg-success, bg-warning, etc.) so the charts stay
// visually consistent with the Gantt bars and badges. Adjust these var
// names if your Tailwind theme defines the tokens differently.
const CHART_COLORS = {
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  primary: "hsl(var(--primary))",
  info: "hsl(var(--info))",
  muted: "hsl(var(--muted-foreground) / 0.25)",
};

function getMonthIndex(dateStr: string) {
  const d = new Date(dateStr);
  return (d.getFullYear() - startYear) * 12 + d.getMonth();
}

function getBarColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-success";
    case "in_progress":
      return "bg-warning";
    case "delayed":
    case "blocked":
      return "bg-destructive";
    case "review":
      return "bg-primary";
    case "ready":
      return "bg-info";
    default:
      return "bg-muted-foreground/30";
  }
}

// Whole-day difference between two dates (end - start). Returns null if
// either is missing/unparsable.
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
// Progress overview dialog: donut chart of % complete + bar chart comparing
// Progress % against Time Elapsed %.
// ============================================================================

function TaskProgressDialog({ task, onClose }: { task: ApiTask | null; onClose: () => void }) {
  if (!task) return null;

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
        ? "On track — progress matches time elapsed."
        : "Ahead of schedule — progress is running ahead of time elapsed."
      : "Behind schedule — time elapsed has outpaced progress."
    : task.status === "completed"
      ? "Task is completed."
      : "Add a start and end date to compare progress against schedule.";

  const scheduleColor = !hasSchedule
    ? "text-muted-foreground"
    : progress >= elapsedPct!
      ? "text-success"
      : "text-destructive";

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getBarColor(task.status).replace("bg-", "bg-") + " text-white"}>
              {statusLabels[task.status as keyof typeof statusLabels] ?? task.status}
            </Badge>
            {task.criticalPath && <Badge variant="destructive">Critical Path</Badge>}
          </div>
          <DialogTitle className="font-display text-xl mt-1">{task.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {task.department}
            {task.startDate && task.endDate ? ` · ${task.startDate} — ${task.endDate}` : ""}
          </p>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-2">
          {/* Donut: overall completion */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-center">Overall Progress</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill={CHART_COLORS.success} />
                    <Cell fill={CHART_COLORS.muted} />
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-2xl font-bold -mt-4">{progress}%</p>
            <p className="text-center text-xs text-muted-foreground">complete</p>
          </div>

          {/* Bar: progress vs time elapsed */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-center">Progress vs. Time Elapsed</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <RechartsTooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {compareData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.name === "Progress" ? CHART_COLORS.primary : CHART_COLORS.warning}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className={`text-center text-xs mt-1 font-medium ${scheduleColor}`}>{scheduleNote}</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center p-2.5 rounded-md border bg-muted/30">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium text-sm">{totalDays === null ? "—" : `${totalDays}d`}</p>
          </div>
          <div className="text-center p-2.5 rounded-md border bg-muted/30">
            <p className="text-xs text-muted-foreground">Time Elapsed</p>
            <p className="font-medium text-sm">{elapsedPct === null ? "—" : `${Math.round(elapsedPct)}%`}</p>
          </div>
          <div className="text-center p-2.5 rounded-md border bg-muted/30">
            <p className="text-xs text-muted-foreground">Priority</p>
            <p className="font-medium text-sm capitalize">{task.priority}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Timeline = () => {
  const [projectFilter, setProjectFilter] = useState("all");
  const [zoom, setZoom] = useState<"month" | "quarter">("month");
  // ✅ NEW: which task's progress overview dialog is open, if any.
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

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t: ApiTask) => projectFilter === "all" || t.projectId === Number(projectFilter)
      ),
    [tasks, projectFilter]
  );

  const colWidth = zoom === "month" ? 80 : 240;

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

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading timeline…</p>;
  }

  if (isError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load timeline{error instanceof ApiError ? `: ${error.message}` : ""}. Is the
        backend running?
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Timeline</h1>
          <p className="text-muted-foreground mt-1">Project execution Gantt view</p>
        </div>
        <div className="flex gap-3">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p: ApiProject) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zoom} onValueChange={(v: "month" | "quarter") => setZoom(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No tasks match this filter yet.
            </p>
          ) : (
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="flex border-b sticky top-0 bg-card z-10">
                <div className="w-[250px] shrink-0 p-3 font-medium text-sm border-r">Task</div>
                <div className="flex">
                  {headerCols.map((col) => (
                    <div key={col.key} className="text-center border-r p-2" style={{ width: colWidth }}>
                      <p className="text-xs font-medium">{col.label}</p>
                      <p className="text-[10px] text-muted-foreground">{col.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {filtered.map((task: ApiTask) => {
                // Tasks without both dates set can't be placed on the Gantt
                // grid — still show the row so nothing silently vanishes.
                // ✅ NEW: still clickable — opens the same overview dialog,
                // which falls back to just the donut (no schedule compare)
                // when there's no start/end date.
                if (!task.startDate || !task.endDate) {
                  return (
                    <div key={task.id} className="flex border-b hover:bg-muted/30 transition-colors">
                      <div className="w-[250px] shrink-0 p-3 border-r">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{task.department}</span>
                          {task.criticalPath && (
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3">
                              CP
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div
                        className="flex-1 relative flex items-center px-3 cursor-pointer"
                        style={{ minWidth: headerCols.length * colWidth }}
                        onClick={() => setSelectedTask(task)}
                      >
                        <span className="text-xs text-muted-foreground italic">No dates set</span>
                      </div>
                    </div>
                  );
                }

                const startIdx = getMonthIndex(task.startDate);
                const endIdx = getMonthIndex(task.endDate);
                const duration = Math.max(1, endIdx - startIdx + 1);
                const leftPx = zoom === "month" ? startIdx * colWidth : (startIdx / 3) * colWidth;
                const widthPx =
                  zoom === "month" ? duration * colWidth - 4 : (duration / 3) * colWidth - 4;

                return (
                  <div key={task.id} className="flex border-b hover:bg-muted/30 transition-colors">
                    <div className="w-[250px] shrink-0 p-3 border-r">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{task.department}</span>
                        {task.criticalPath && (
                          <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3">
                            CP
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 relative" style={{ minWidth: headerCols.length * colWidth }}>
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {headerCols.map((col) => (
                          <div key={col.key} className="border-r h-full" style={{ width: colWidth }} />
                        ))}
                      </div>
                      {/* Bar — click opens the Progress Overview dialog */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-2.5 h-5 rounded-full ${getBarColor(
                              task.status
                            )} cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 transition-all`}
                            style={{ left: leftPx + 2, width: Math.max(widthPx, 8) }}
                            onClick={() => setSelectedTask(task)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs">
                            {statusLabels[task.status as keyof typeof statusLabels]} · {task.progress}%
                          </p>
                          <p className="text-xs">
                            {task.startDate} — {task.endDate}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">Click for full progress overview</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Dependency arrows (simplified) */}
                      {task.dependencies.length > 0 && (
                        <div
                          className="absolute top-5 h-0.5 bg-muted-foreground/20"
                          style={{ left: 0, width: leftPx }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ NEW: Progress Overview dialog for whichever task was clicked */}
      <TaskProgressDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
};

export default Timeline;