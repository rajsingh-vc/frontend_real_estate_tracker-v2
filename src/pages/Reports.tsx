import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, AlertTriangle, CheckCircle2, Clock, TrendingUp, ArrowLeft,
  ChevronRight, Download, Layers, FileSpreadsheet, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── API imports ──
import {
  projectsApi,
  tasksApi,
  hurdlesApi,
  towersApi,
  floorsApi,
  resolveImageUrl,
  type ApiProject,
  type ApiTask,
  type ApiHurdle,
  type ApiTower,
  type ApiFloor,
} from "@/lib/api";

// ── Helper: export CSV ──
function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${(cell ?? '').replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── Status helpers ──
const statusColorMap: Record<string, string> = {
  completed: 'hsl(152, 60%, 42%)',
  in_progress: 'hsl(38, 92%, 50%)',
  delayed: 'hsl(0, 72%, 51%)',
  blocked: 'hsl(0, 62%, 40%)',
  not_started: 'hsl(220, 14%, 80%)',
  review: 'hsl(224, 76%, 48%)',
  ready: 'hsl(200, 80%, 50%)',
};

// We'll map API status strings to display labels.
// The API might return status values like "completed", "in_progress", etc.
// We'll use a simple mapping; if unknown, we capitalize it.
const statusLabels: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  delayed: "Delayed",
  blocked: "Blocked",
  not_started: "Not Started",
  review: "Review",
  ready: "Ready",
};
const statusColors: Record<string, string> = {
  completed: "bg-success text-success-foreground",
  in_progress: "bg-warning text-warning-foreground",
  delayed: "bg-destructive text-destructive-foreground",
  blocked: "bg-destructive/90 text-destructive-foreground",
  not_started: "bg-muted text-muted-foreground",
  review: "bg-info text-info-foreground",
  ready: "bg-secondary text-secondary-foreground",
};

function getStatusPieData(taskList: ApiTask[]) {
  const counts: Record<string, number> = {};
  taskList.forEach(t => {
    const s = t.status || 'unknown';
    counts[s] = (counts[s] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([status, value]) => ({
      name: statusLabels[status] || status,
      value,
      color: statusColorMap[status] || 'hsl(220, 14%, 80%)',
    }))
    .filter(d => d.value > 0);
}

function getDeptBreakdown(taskList: ApiTask[]) {
  const depts: Record<string, { completed: number; inProgress: number; delayed: number }> = {};
  taskList.forEach(t => {
    if (!depts[t.department]) depts[t.department] = { completed: 0, inProgress: 0, delayed: 0 };
    if (t.status === 'completed') depts[t.department].completed++;
    else if (t.status === 'delayed' || t.status === 'blocked') depts[t.department].delayed++;
    else depts[t.department].inProgress++;
  });
  return Object.entries(depts).map(([name, data]) => ({ name, ...data }));
}

function getDelayByDepartment(taskList: ApiTask[]) {
  const depts: Record<string, { delayed: number; totalDelay: number }> = {};
  taskList.forEach(t => {
    if (!depts[t.department]) depts[t.department] = { delayed: 0, totalDelay: 0 };
    if (t.delayDays > 0) depts[t.department].delayed++;
    depts[t.department].totalDelay += t.delayDays;
  });
  return Object.entries(depts)
    .map(([name, data]) => ({ name, ...data }))
    .filter(d => d.delayed > 0 || d.totalDelay > 0);
}

// ── Chart tooltip ──
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-medium">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.payload?.color }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── StatCard ──
function StatCard({ label, value, icon, subtitle }: { label: string; value: number | string; icon: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl md:text-3xl font-display font-bold mt-1">{value}</p>
          </div>
          {icon}
        </div>
        {subtitle && <div className="mt-2">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

// ── ActivityTable ──
function ActivityTable({ taskList, title, onDrillTask, projects }: {
  taskList: ApiTask[];
  title: string;
  onDrillTask?: (task: ApiTask) => void;
  projects: ApiProject[];
}) {
  const handleExport = () => {
    exportToCSV(
      title.replace(/\s+/g, '_'),
      ['Task', 'Department', 'Phase', 'Status', 'Priority', 'Progress %', 'Delay Days', 'Delay Reason', 'Start Date', 'End Date', 'Critical Path'],
      taskList.map(t => [
        t.title, t.department, t.phase || '', statusLabels[t.status] || t.status, t.priority,
        String(t.progress), String(t.delayDays), t.delayReason || '', t.startDate || '', t.endDate || '',
        t.criticalPath ? 'Yes' : 'No',
      ])
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display">{title}</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map(task => (
              <TableRow
                key={task.id}
                className={onDrillTask ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onDrillTask?.(task)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{task.title}</span>
                    {task.criticalPath && <Badge variant="destructive" className="text-[9px] px-1 py-0">CP</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{task.department}</TableCell>
                <TableCell className="text-sm">{task.phase}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[task.status] || 'bg-muted'} text-[10px]`}>
                    {statusLabels[task.status] || task.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress} className="h-1.5 w-16" />
                    <span className="text-xs font-medium">{task.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.delayDays > 0 ? (
                    <div>
                      <Badge variant="destructive" className="text-[10px]">+{task.delayDays}d</Badge>
                      {task.delayReason && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate">{task.delayReason}</p>}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">{task.priority}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {taskList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tasks found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Task Drill-Down ──
function TaskDrillDown({ task, onBack, projects, towers }: {
  task: ApiTask;
  onBack: () => void;
  projects: ApiProject[];
  towers: ApiTower[];
}) {
  const project = projects.find(p => p.id === task.projectId);
  const tower = towers.find(t => t.id === task.towerId);

  const handleExport = () => {
    exportToCSV(
      `Task_${task.title.replace(/\s+/g, '_')}`,
      ['Field', 'Value'],
      [
        ['Task', task.title], ['Description', task.description || ''], ['Project', project?.name || ''],
        ['Tower', tower?.name || ''], ['Department', task.department], ['Phase', task.phase || ''],
        ['Status', statusLabels[task.status] || task.status], ['Priority', task.priority], ['Progress', `${task.progress}%`],
        ['Start Date', task.startDate || ''], ['End Date', task.endDate || ''],
        ['Actual Start', task.actualStartDate || ''], ['Actual End', task.actualEndDate || ''],
        ['Delay Days', String(task.delayDays)], ['Delay Reason', task.delayReason || ''],
        ['Critical Path', task.criticalPath ? 'Yes' : 'No'],
        ...(task.checklist || []).map((c, i) => [`Checklist ${i + 1}`, `${c.completed ? '✓' : '○'} ${c.title}`]),
        ...(task.comments || []).map((c, i) => [`Comment ${i + 1}`, `${c.user} (${c.date}): ${c.text}`]),
      ]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Reports</span><ChevronRight className="h-3 w-3" />
            <span>{project?.name}</span><ChevronRight className="h-3 w-3" />
            <span>{tower?.name}</span><ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{task.title}</span>
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">Task Detail</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="font-display text-lg">Task Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={statusColors[task.status] || 'bg-muted'}>{statusLabels[task.status] || task.status}</Badge>
              <Badge variant="outline" className="capitalize">{task.priority}</Badge>
              {task.criticalPath && <Badge variant="destructive">Critical Path</Badge>}
            </div>
            <h3 className="font-display font-bold text-xl">{task.title}</h3>
            <p className="text-sm text-muted-foreground">{task.description}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{task.department}</span></div>
              <div><span className="text-muted-foreground">Phase:</span> <span className="font-medium">{task.phase}</span></div>
              <div><span className="text-muted-foreground">Planned:</span> <span className="font-medium">{task.startDate} — {task.endDate}</span></div>
              {task.actualStartDate && <div><span className="text-muted-foreground">Actual Start:</span> <span className="font-medium">{task.actualStartDate}</span></div>}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Progress</span><span className="font-bold">{task.progress}%</span></div>
              <Progress value={task.progress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="font-display text-lg">Delay & Impact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {task.delayDays > 0 ? (
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-display font-bold text-destructive">{task.delayDays} days</span>
                </div>
                <p className="text-sm text-muted-foreground">{task.delayReason || 'No reason specified'}</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-success/5 border border-success/20 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm font-medium text-success">No delays recorded</span>
              </div>
            )}
            {(task.checklist || []).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Checklist ({task.checklist.filter(c => c.completed).length}/{task.checklist.length})</h4>
                <div className="space-y-1.5">
                  {task.checklist.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center ${c.completed ? 'bg-success border-success text-success-foreground' : 'border-border'}`}>
                        {c.completed && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <span className={c.completed ? 'line-through text-muted-foreground' : ''}>{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(task.comments || []).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Activity Log</h4>
                {task.comments.map((c, i) => (
                  <div key={i} className="p-2 rounded bg-muted/50 text-xs mb-1.5">
                    <span className="font-medium">{c.user}</span> <span className="text-muted-foreground">· {c.date}</span>
                    <p className="text-muted-foreground mt-0.5">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Status focus types and explanation ──
type StatusFocusKey = 'completed' | 'inProgress' | 'delayed';

const STATUS_FOCUS_META: Record<StatusFocusKey, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'hsl(152, 60%, 42%)' },
  inProgress: { label: 'In Progress', color: 'hsl(38, 92%, 50%)' },
  delayed: { label: 'Delayed / Blocked', color: 'hsl(0, 72%, 51%)' },
};

function buildStatusExplanation(
  focus: StatusFocusKey,
  department: string,
  counts: { completed: number; inProgress: number; delayed: number; total: number; totalDelayDays: number },
  topReasons: string[]
) {
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);
  if (focus === 'completed') {
    return `${counts.completed} of ${counts.total} tasks (${pct(counts.completed)}%) in ${department} have been marked complete. These finished on or ahead of their planned checklist and no longer carry any schedule risk.`;
  }
  if (focus === 'inProgress') {
    return `${counts.inProgress} of ${counts.total} tasks (${pct(counts.inProgress)}%) in ${department} are actively underway — that covers work that's in progress, in review, ready to start, or not yet started, as long as it isn't currently marked delayed or blocked. None of these are flagged as behind schedule right now.`;
  }
  const reasonsText = topReasons.length
    ? ` The most common reasons cited: ${topReasons.join('; ')}.`
    : '';
  return `${counts.delayed} of ${counts.total} tasks (${pct(counts.delayed)}%) in ${department} are delayed or blocked, adding up to ${counts.totalDelayDays} cumulative delay days across the department.${reasonsText}`;
}

// ── Status Breakdown Bar (hover shows only one segment) ──
function StatusBreakdownBar({ data, labelWidth = 100 }: { data: any[]; labelWidth?: number }) {
  const [hoveredKey, setHoveredKey] = useState<StatusFocusKey | null>(null);
  const onOver = (key: StatusFocusKey) => setHoveredKey(key);
  const onOut = () => setHoveredKey(null);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={labelWidth} />
        <Tooltip
          cursor={false}
          content={({ active, payload, label }) => {
            if (!active || !payload || !payload.length) return null;
            const filtered = hoveredKey ? payload.filter((p: any) => p.dataKey === hoveredKey) : payload;
            if (filtered.length === 0) return null;
            return (
              <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                <p className="text-xs font-medium">{label}</p>
                {filtered.map((entry: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.fill }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Bar dataKey="completed" stackId="a" fill="hsl(152, 60%, 42%)" name="Completed" onMouseOver={() => onOver('completed')} onMouseOut={onOut} />
        <Bar dataKey="inProgress" stackId="a" fill="hsl(38, 92%, 50%)" name="In Progress" onMouseOver={() => onOver('inProgress')} onMouseOut={onOut} />
        <Bar dataKey="delayed" stackId="a" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} name="Delayed" onMouseOver={() => onOver('delayed')} onMouseOut={onOut} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Department Drill-Down ──
function DepartmentDrillDown({ department, focusStatus, scopeProjectId, onBack, onDrillTask, tasks, projects, towers }: {
  department: string;
  focusStatus?: StatusFocusKey | null;
  scopeProjectId?: number | null;
  onBack: () => void;
  onDrillTask: (task: ApiTask) => void;
  tasks: ApiTask[];
  projects: ApiProject[];
  towers: ApiTower[];
}) {
  const scopeProject = scopeProjectId ? projects.find(p => p.id === scopeProjectId) : null;
  const deptTasks = tasks.filter(t => t.department === department && (!scopeProjectId || t.projectId === scopeProjectId));
  const completedTasks = deptTasks.filter(t => t.status === 'completed');
  const delayedTasks = deptTasks.filter(t => t.status === 'delayed' || t.status === 'blocked');
  const inProgressTasks = deptTasks.filter(t => t.status !== 'completed' && t.status !== 'delayed' && t.status !== 'blocked');
  const totalDelay = deptTasks.reduce((sum, t) => sum + t.delayDays, 0);
  const projectBreakdown = projects.map(p => {
    const pTasks = deptTasks.filter(t => t.projectId === p.id);
    return {
      name: p.name,
      completed: pTasks.filter(t => t.status === 'completed').length,
      inProgress: pTasks.filter(t => t.status !== 'completed' && t.status !== 'delayed' && t.status !== 'blocked').length,
      delayed: pTasks.filter(t => t.status === 'delayed' || t.status === 'blocked').length,
    };
  }).filter(d => d.completed + d.inProgress + d.delayed > 0);

  const focusTaskList = focusStatus === 'completed' ? completedTasks : focusStatus === 'delayed' ? delayedTasks : focusStatus === 'inProgress' ? inProgressTasks : null;
  const topDelayReasons = Array.from(new Set(delayedTasks.map(t => t.delayReason).filter(Boolean) as string[])).slice(0, 3);

  const handleExport = () => {
    exportToCSV(
      `${department}_Department_Tasks`,
      ['Project', 'Task', 'Phase', 'Status', 'Priority', 'Progress %', 'Delay Days', 'Delay Reason'],
      deptTasks.map(t => {
        const p = projects.find(p => p.id === t.projectId);
        return [p?.name || '', t.title, t.phase || '', statusLabels[t.status] || t.status, t.priority, String(t.progress), String(t.delayDays), t.delayReason || ''];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Reports</span><ChevronRight className="h-3 w-3" />
            {scopeProject && (<><span>{scopeProject.name}</span><ChevronRight className="h-3 w-3" /></>)}
            <span className="text-foreground font-medium">{department} Department</span>
            {focusStatus && (<><ChevronRight className="h-3 w-3" /><span className="text-foreground font-medium">{STATUS_FOCUS_META[focusStatus].label}</span></>)}
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">{department} – Performance Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {deptTasks.length} total tasks {scopeProject ? `in ${scopeProject.name}` : 'across all projects'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={deptTasks.length} icon={<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Layers className="h-5 w-5 text-primary" /></div>} />
        <StatCard label="Completed" value={completedTasks.length} icon={<div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>} subtitle={<Progress value={deptTasks.length > 0 ? (completedTasks.length / deptTasks.length) * 100 : 0} className="h-1.5" />} />
        <StatCard label="In Progress" value={inProgressTasks.length} icon={<div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-warning" /></div>} />
        <StatCard label="Delayed / Blocked" value={delayedTasks.length} icon={<div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>} subtitle={<span className="text-xs text-muted-foreground">{totalDelay} total delay days</span>} />
      </div>

      {focusStatus && focusTaskList && (
        <Card style={{ borderColor: STATUS_FOCUS_META[focusStatus].color }} className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_FOCUS_META[focusStatus].color }} />
              {STATUS_FOCUS_META[focusStatus].label} in {department} — What This Means
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {buildStatusExplanation(
                focusStatus,
                department,
                { completed: completedTasks.length, inProgress: inProgressTasks.length, delayed: delayedTasks.length, total: deptTasks.length, totalDelayDays: totalDelay },
                topDelayReasons
              )}
            </p>
            <div className="space-y-2">
              {focusTaskList.slice(0, 8).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onDrillTask(task)}>
                  <Badge className={`${statusColors[task.status] || 'bg-muted'} text-[10px] shrink-0`}>{statusLabels[task.status] || task.status}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{projects.find(p => p.id === task.projectId)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Progress value={task.progress} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">{task.progress}%</span>
                  </div>
                  {task.delayDays > 0 && <Badge variant="destructive" className="text-[9px] shrink-0">+{task.delayDays}d</Badge>}
                </div>
              ))}
              {focusTaskList.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tasks in this bucket right now.</p>}
              {focusTaskList.length > 8 && <p className="text-xs text-muted-foreground text-center pt-1">+{focusTaskList.length - 8} more in the full table below</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={getStatusPieData(deptTasks)} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {getStatusPieData(deptTasks).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {getStatusPieData(deptTasks).map(item => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Tasks per Project</CardTitle></CardHeader>
          <CardContent>
            <StatusBreakdownBar data={projectBreakdown} labelWidth={100} />
          </CardContent>
        </Card>
      </div>

      <ActivityTable taskList={deptTasks} title={`${department} — All Tasks`} onDrillTask={onDrillTask} projects={projects} />
    </div>
  );
}

// ── Project Drill-Down ──
function ProjectDrillDown({ project, onBack, onDrillTower, onDrillTask, tasks, towers, hurdles }: {
  project: ApiProject;
  onBack: () => void;
  onDrillTower: (tower: ApiTower) => void;
  onDrillTask: (task: ApiTask) => void;
  tasks: ApiTask[];
  towers: ApiTower[];
  hurdles: ApiHurdle[];
}) {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const projectTowers = towers.filter(t => t.projectId === project.id);
  const projectHurdles = hurdles.filter(h => h.projectId === project.id);

  const handleExport = () => {
    exportToCSV(
      `${project.name}_Overview`,
      ['Tower', 'Task', 'Department', 'Phase', 'Status', 'Progress %', 'Delay Days', 'Delay Reason'],
      projectTasks.map(t => {
        const tw = towers.find(tw => tw.id === t.towerId);
        return [tw?.name || '', t.title, t.department, t.phase || '', statusLabels[t.status] || t.status, String(t.progress), String(t.delayDays), t.delayReason || ''];
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          {resolveImageUrl(project.organizationLogo) && (
            <img
              src={resolveImageUrl(project.organizationLogo)!}
              alt={project.organizationName || "Organization"}
              className="h-10 w-10 rounded-xl object-contain border bg-white p-1 shrink-0 shadow-xs"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
              <span>Reports</span><ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium truncate">{project.name}</span>
            </div>
            <h1 className="font-display text-2xl font-bold mt-0.5 truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {[project.organizationName, project.location].filter(Boolean).join(" · ")} · RERA: {project.reraNumber}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="self-start sm:self-auto"><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={projectTasks.length} icon={<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>} />
        <StatCard label="Completion" value={`${project.progress}%`} icon={<div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>} subtitle={<Progress value={project.progress} className="h-1.5" />} />
        <StatCard label="Towers" value={projectTowers.length} icon={<div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-info" /></div>} />
        <StatCard label="Active Hurdles" value={projectHurdles.filter(h => h.status !== 'resolved').length} icon={<div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Task Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={getStatusPieData(projectTasks)} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {getStatusPieData(projectTasks).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {getStatusPieData(projectTasks).map(item => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Department Performance</CardTitle></CardHeader>
          <CardContent>
            <StatusBreakdownBar data={getDeptBreakdown(projectTasks)} labelWidth={70} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Tower Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {projectTowers.map(tower => {
              const tTasks = tasks.filter(t => t.towerId === tower.id);
              const delayed = tTasks.filter(t => t.delayDays > 0).length;
              const totalDelay = tTasks.reduce((a, t) => a + t.delayDays, 0);
              return (
                <div key={tower.id}
                  onClick={() => onDrillTower(tower)}
                  className="flex items-center gap-4 p-4 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-display font-bold">{tower.name}</p>
                      <Badge variant="secondary" className="text-xs">{tower.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tTasks.length} tasks · {tower.totalFloors} floors</p>
                    <Progress value={tower.progress} className="h-1.5 mt-2" />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-medium">{tower.progress}%</span>
                      {delayed > 0 && <span className="text-xs text-destructive font-medium">{delayed} delayed ({totalDelay}d impact)</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {projectTasks.filter(t => t.delayDays > 0).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Clock className="h-5 w-5 text-destructive" />Delay Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectTasks.filter(t => t.delayDays > 0).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => onDrillTask(task)}>
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.delayReason}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">+{task.delayDays}d</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Custom Stacked Bar (Department Performance) ──
function StackedBarWithHoverTooltip({ data, onSegmentClick }: { data: any[]; onSegmentClick?: (deptName: string, status: StatusFocusKey) => void }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const onMouseOver = (dataKey: string) => setHoveredKey(dataKey);
  const onMouseOut = () => setHoveredKey(null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 10 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          cursor={false}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const filtered = hoveredKey ? payload.filter(p => p.dataKey === hoveredKey) : payload;
              if (filtered.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium">{label}</p>
                  {filtered.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">Click for details →</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Bar
          dataKey="completed"
          stackId="a"
          fill="hsl(152, 60%, 42%)"
          name="Completed"
          cursor="pointer"
          onMouseOver={() => onMouseOver('completed')}
          onMouseOut={onMouseOut}
          onClick={(data: any) => onSegmentClick?.(data.name, 'completed')}
        />
        <Bar
          dataKey="inProgress"
          stackId="a"
          fill="hsl(38, 92%, 50%)"
          name="In Progress"
          cursor="pointer"
          onMouseOver={() => onMouseOver('inProgress')}
          onMouseOut={onMouseOut}
          onClick={(data: any) => onSegmentClick?.(data.name, 'inProgress')}
        />
        <Bar
          dataKey="delayed"
          stackId="a"
          fill="hsl(0, 72%, 51%)"
          name="Delayed"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          onMouseOver={() => onMouseOver('delayed')}
          onMouseOut={onMouseOut}
          onClick={(data: any) => onSegmentClick?.(data.name, 'delayed')}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Custom Line Chart (Progress Trend) ──
function LineChartWithHoverTooltip({ data, lines }: { data: any[]; lines: { key: string; name: string; color: string }[] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const onMouseOver = (dataKey: string) => setHoveredKey(dataKey);
  const onMouseOut = () => setHoveredKey(null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const filtered = hoveredKey ? payload.filter(p => p.dataKey === hoveredKey) : payload;
              if (filtered.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium">{label}</p>
                  {filtered.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium">{entry.value}%</span>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        {lines.map(line => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            onMouseOver={() => onMouseOver(line.key)}
            onMouseOut={onMouseOut}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Custom Delay Bar Chart ──
function DelayBarChartWithHoverTooltip({ data, onClick }: { data: any[]; onClick?: (data: any) => void }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const onMouseOver = (dataKey: string) => setHoveredKey(dataKey);
  const onMouseOut = () => setHoveredKey(null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} onClick={onClick}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          cursor={false}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const filtered = hoveredKey ? payload.filter(p => p.dataKey === hoveredKey) : payload;
              if (filtered.length === 0) return null;
              return (
                <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                  <p className="text-xs font-medium">{label}</p>
                  {filtered.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Bar
          dataKey="delayed"
          name="Delayed Tasks"
          fill="hsl(0, 72%, 51%)"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          onMouseOver={() => onMouseOver('delayed')}
          onMouseOut={onMouseOut}
        />
        <Bar
          dataKey="totalDelay"
          name="Total Delay Days"
          fill="hsl(38, 92%, 50%)"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          onMouseOver={() => onMouseOver('totalDelay')}
          onMouseOut={onMouseOut}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── MAIN REPORTS COMPONENT ──
const Reports = () => {
  // ── Data state ──
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [hurdles, setHurdles] = useState<ApiHurdle[]>([]);
  const [towers, setTowers] = useState<ApiTower[]>([]);
  const [floors, setFloors] = useState<ApiFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Drill state ──
  const [drillLevel, setDrillLevel] = useState<'overview' | 'project' | 'department' | 'task'>('overview');
  const [selectedProject, setSelectedProject] = useState<ApiProject | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedStatusFocus, setSelectedStatusFocus] = useState<StatusFocusKey | null>(null);
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);

  // ── Project filter ──
  const [reportProjectFilter, setReportProjectFilter] = useState<string>('all');

  // ── Fetch data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, projectsData, hurdlesData, towersData, floorsData] = await Promise.all([
          tasksApi.list(),
          projectsApi.list(),
          hurdlesApi.list(),
          towersApi.list(),
          floorsApi.list(),
        ]);
        setTasks(tasksData);
        setProjects(projectsData);
        setHurdles(hurdlesData);
        setTowers(towersData);
        setFloors(floorsData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load data"));
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Active Projects Filter ──
  const validProjects = useMemo(() => {
    return projects.filter(
      (p) => p && p.status?.toLowerCase() !== "deleted" && p.status?.toLowerCase() !== "archived"
    );
  }, [projects]);

  const activeProjectIds = useMemo(() => new Set(validProjects.map((p) => p.id)), [validProjects]);

  const validTasks = useMemo(() => {
    return tasks.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
  }, [tasks, activeProjectIds]);

  const validTowers = useMemo(() => {
    return towers.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
  }, [towers, activeProjectIds]);

  const validHurdles = useMemo(() => {
    return hurdles.filter((h) => {
      if (h.affectedTaskId) return validTasks.some((t) => t.id === h.affectedTaskId);
      return true;
    });
  }, [hurdles, validTasks]);

  // ── Memoized derivatives ──
  const activeProject = useMemo(() => {
    if (reportProjectFilter === "all") return null;
    return validProjects.find((p) => String(p.id) === reportProjectFilter) ?? null;
  }, [validProjects, reportProjectFilter]);

  const filteredTasks = useMemo(() => {
    if (!activeProject) return validTasks;
    return validTasks.filter((t) => t.projectId === activeProject.id);
  }, [validTasks, activeProject]);

  const deptPerformanceData = useMemo(() => getDeptBreakdown(filteredTasks), [filteredTasks]);

  const delayByProject = useMemo(() => {
    return validProjects.map((p) => ({
      name: p.name.split(" ")[0],
      delayed: validTasks.filter((t) => t.projectId === p.id && t.delayDays > 0).length,
      totalDelay: validTasks.filter((t) => t.projectId === p.id).reduce((a, t) => a + (t.delayDays || 0), 0),
    }));
  }, [validProjects, validTasks]);

  const delayByDepartment = useMemo(() => getDelayByDepartment(filteredTasks), [filteredTasks]);

  const delayChartData = activeProject ? delayByDepartment : delayByProject;

  // ── Dynamic Progress Trend ──
  const dynamicTrend = useMemo(() => {
    if (validProjects.length === 0) return { data: [], lines: [] };
    const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const palette = [
      "hsl(224, 76%, 48%)",
      "hsl(152, 60%, 42%)",
      "hsl(38, 92%, 50%)",
      "hsl(280, 65%, 60%)",
      "hsl(190, 85%, 45%)",
    ];

    const displayProjects = activeProject ? [activeProject] : validProjects.slice(0, 5);
    const lines = displayProjects.map((p, idx) => ({
      key: `p_${p.id}`,
      name: p.name,
      color: palette[idx % palette.length],
    }));

    const data = months.map((m, mIdx) => {
      const entry: any = { month: m };
      displayProjects.forEach((p) => {
        const factor = (mIdx + 1) / months.length;
        entry[`p_${p.id}`] = Math.round((p.progress || 0) * factor);
      });
      return entry;
    });

    return { data, lines };
  }, [validProjects, activeProject]);

  // ── Drill handlers ──
  const handleDepartmentSegmentClick = (deptName: string, status: StatusFocusKey) => {
    setSelectedDepartment(deptName);
    setSelectedStatusFocus(status);
    setDrillLevel("department");
  };

  const handleProjectDelayClick = (data: any) => {
    if (!data || !data.activePayload || data.activePayload.length === 0) return;
    const barName = data.activePayload[0].payload.name;
    if (activeProject) {
      // In single-project view the bars are departments — drill into that department.
      setSelectedDepartment(barName);
      setSelectedStatusFocus(null);
      setDrillLevel("department");
    } else {
      const project = validProjects.find((p) => p.name.startsWith(barName));
      if (project) {
        setSelectedProject(project);
        setDrillLevel("project");
      }
    }
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading reports data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-destructive">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-semibold">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Render drill views ──
  if (drillLevel === 'task' && selectedTask) {
    return (
      <TaskDrillDown
        task={selectedTask}
        onBack={() => { setDrillLevel('overview'); setSelectedTask(null); }}
        projects={validProjects}
        towers={validTowers}
      />
    );
  }

  if (drillLevel === 'department' && selectedDepartment) {
    return (
      <DepartmentDrillDown
        department={selectedDepartment}
        focusStatus={selectedStatusFocus}
        scopeProjectId={activeProject?.id ?? null}
        onBack={() => { setDrillLevel('overview'); setSelectedDepartment(null); setSelectedStatusFocus(null); }}
        onDrillTask={(task) => { setSelectedTask(task); setDrillLevel('task'); }}
        tasks={validTasks}
        projects={validProjects}
        towers={validTowers}
      />
    );
  }

  if (drillLevel === 'project' && selectedProject) {
    return (
      <ProjectDrillDown
        project={selectedProject}
        onBack={() => { setDrillLevel('overview'); setSelectedProject(null); }}
        onDrillTower={(tower) => {
          const towerTask = validTasks.find((t) => t.towerId === tower.id);
          if (towerTask) {
            setSelectedTask(towerTask);
            setDrillLevel('task');
          }
        }}
        onDrillTask={(task) => { setSelectedTask(task); setDrillLevel('task'); }}
        tasks={validTasks}
        towers={validTowers}
        hurdles={validHurdles}
      />
    );
  }

  // ── Empty State if no active projects ──
  if (validProjects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and insights across active projects</p>
        </div>
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg">No Active Projects Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            All reports, charts, and statistics represent currently existing projects only. Create or activate a project to begin viewing live performance dashboards.
          </p>
        </Card>
      </div>
    );
  }

  // ── Overview ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and insights – click on charts to drill down</p>
        </div>
        <Select value={reportProjectFilter} onValueChange={setReportProjectFilter}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {validProjects.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>
                <div className="flex items-center gap-2">
                  {resolveImageUrl(p.organizationLogo) && (
                    <img
                      src={resolveImageUrl(p.organizationLogo)!}
                      alt=""
                      className="h-4 w-4 rounded object-contain border bg-white p-0.5 shrink-0"
                    />
                  )}
                  <span className="truncate">{p.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Progress Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Progress Trend {activeProject && <span className="text-xs text-muted-foreground font-normal ml-2">{activeProject.name}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dynamicTrend.lines.length > 0 ? (
              <LineChartWithHoverTooltip data={dynamicTrend.data} lines={dynamicTrend.lines} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No progress trend data available for current selection.</p>
            )}
          </CardContent>
        </Card>

        {/* Delay Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Delay Analysis
              <span className="text-xs text-muted-foreground font-normal ml-2">
                {activeProject ? 'By department · click a bar →' : 'By project · click a bar →'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {delayChartData.length > 0 ? (
              <DelayBarChartWithHoverTooltip data={delayChartData} onClick={handleProjectDelayClick} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No delays recorded{activeProject ? ` for ${activeProject.name}` : ''}.</p>
            )}
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Department Performance {activeProject && <span className="text-xs text-muted-foreground font-normal ml-2">{activeProject.name}</span>}
              <span className="text-xs text-muted-foreground font-normal ml-2">Click a segment (completed / in progress / delayed) →</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deptPerformanceData.length > 0 ? (
              <StackedBarWithHoverTooltip data={deptPerformanceData} onSegmentClick={handleDepartmentSegmentClick} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">No department task data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;