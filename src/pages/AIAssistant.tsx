import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, Trash2, ArrowLeft, ChevronRight, History,
  Building2, AlertTriangle, Clock, Construction, Users, Activity,
  PieChart as PieChartIcon, type LucideIcon, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  projectsApi,
  tasksApi,
  hurdlesApi,
  towersApi,
  analyticsApi,
  ApiError,
  type ApiProject,
  type ApiTask,
  type ApiHurdle,
  type ApiTower,
} from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";

/* =========================================================================
 * 1. CHART SPEC & TYPES
 * ===================================================================== */
type ChartBarSeries = { key: string; name: string; color: string; drillTemplate?: string };
type ChartSpec =
  | { kind: "bar"; title: string; data: any[]; bars: ChartBarSeries[]; layout?: "horizontal" | "vertical"; stacked?: boolean }
  | { kind: "pie"; title: string; data: { name: string; value: number; color: string; drillQuery?: string }[] }
  | { kind: "line"; title: string; data: any[]; lines: { key: string; name: string; color: string }[] };

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  chart?: ChartSpec;
  charts?: ChartSpec[];
  grounded?: boolean;
};

interface LiveContext {
  projects: ApiProject[];
  tasks: ApiTask[];
  towers: ApiTower[];
  hurdles: ApiHurdle[];
}

/* =========================================================================
 * 2. CHART TOOLTIP & RENDERER
 * ===================================================================== */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-medium">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.fill ?? entry.payload?.color }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChatChart({ chart, onDrillQuery }: { chart: ChartSpec; onDrillQuery?: (q: string) => void }) {
  if (!chart.data || chart.data.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50 text-center py-4 text-xs text-muted-foreground">
        No data available for this chart.
      </div>
    );
  }

  if (chart.kind === "pie") {
    const drillable = chart.data.some((d) => d.drillQuery);
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-semibold mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chart.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={65}
              paddingAngle={3}
              onClick={(data: any) => {
                const q = data?.payload?.drillQuery ?? data?.drillQuery;
                if (q) onDrillQuery?.(q);
              }}
            >
              {chart.data.map((d, i) => (
                <Cell key={i} fill={d.color} cursor={d.drillQuery ? "pointer" : undefined} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {chart.data.map((d) => (
            <div
              key={d.name}
              onClick={() => d.drillQuery && onDrillQuery?.(d.drillQuery)}
              className={`flex items-center gap-1.5 text-[11px] ${d.drillQuery ? "cursor-pointer hover:underline" : ""}`}
            >
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground truncate">{d.name}</span>
              <span className="font-medium ml-auto">{d.value}</span>
            </div>
          ))}
        </div>
        {drillable && <p className="text-[10px] text-muted-foreground mt-2 text-center">Tap a slice to dig deeper →</p>}
      </div>
    );
  }

  if (chart.kind === "line") {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-semibold mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {chart.lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const vertical = chart.layout === "vertical";
  const drillable = chart.bars.some((b) => b.drillTemplate);
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={vertical ? Math.max(160, chart.data.length * 34 + 20) : 220}>
        <BarChart data={chart.data} layout={vertical ? "vertical" : "horizontal"} margin={{ left: vertical ? 8 : 0, bottom: vertical ? 0 : 28 }}>
          {vertical ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={88} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
              <YAxis tick={{ fontSize: 10 }} />
            </>
          )}
          <Tooltip cursor={false} content={<ChartTooltip />} />
          {chart.bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {chart.bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              fill={b.color}
              stackId={chart.stacked ? "a" : undefined}
              radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              cursor={b.drillTemplate ? "pointer" : undefined}
              onClick={(data: any) => {
                if (!b.drillTemplate) return;
                const label = data?._fullLabel || data?.name || "";
                const q = b.drillTemplate.replace("{label}", label).replace("{seriesName}", b.name);
                onDrillQuery?.(q);
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {drillable && <p className="text-[10px] text-muted-foreground mt-2 text-center">Tap a bar to dig deeper →</p>}
    </div>
  );
}

function AnswerBody({
  text,
  chart,
  charts,
  onDrillQuery,
}: {
  text: string;
  chart?: ChartSpec;
  charts?: ChartSpec[];
  onDrillQuery?: (q: string) => void;
}) {
  const allCharts = charts && charts.length > 0 ? charts : chart ? [chart] : [];
  return (
    <>
      <div className="whitespace-pre-line leading-relaxed">
        {text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part
        )}
      </div>
      {allCharts.map((c, i) => (
        <ChatChart key={i} chart={c} onDrillQuery={onDrillQuery} />
      ))}
    </>
  );
}

/* =========================================================================
 * 3. DYNAMIC DATA ENGINE — Uses LiveContext only
 * ===================================================================== */
const statusColorMap: Record<string, string> = {
  completed: "hsl(152, 60%, 42%)",
  in_progress: "hsl(38, 92%, 50%)",
  delayed: "hsl(0, 72%, 51%)",
  blocked: "hsl(0, 62%, 40%)",
  not_started: "hsl(220, 14%, 80%)",
  review: "hsl(224, 76%, 48%)",
  ready: "hsl(200, 80%, 50%)",
};

const severityColor: Record<string, string> = {
  critical: "hsl(0, 72%, 51%)",
  high: "hsl(38, 92%, 50%)",
  medium: "hsl(200, 80%, 50%)",
  low: "hsl(152, 60%, 42%)",
};

function buildStatusPieData(list: ApiTask[], contextLabel?: string) {
  const byStatus: Record<string, number> = {};
  list.forEach((t) => {
    const s = t.status || "not_started";
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  return Object.entries(byStatus)
    .map(([status, value]) => {
      const name = status.replace("_", " ");
      return {
        name,
        value,
        color: statusColorMap[status] || "hsl(220, 14%, 70%)",
        drillQuery: contextLabel ? `Explain ${name} tasks in ${contextLabel}` : `Explain ${name} tasks`,
      };
    })
    .filter((d) => d.value > 0);
}

function buildDeptStatusBars(list: ApiTask[]) {
  const byDept: Record<string, { completed: number; inProgress: number; delayed: number }> = {};
  list.forEach((t) => {
    const dept = t.department || "General";
    if (!byDept[dept]) byDept[dept] = { completed: 0, inProgress: 0, delayed: 0 };
    if (t.status === "completed") byDept[dept].completed++;
    else if (t.status === "delayed" || t.status === "blocked") byDept[dept].delayed++;
    else byDept[dept].inProgress++;
  });
  return Object.entries(byDept).map(([name, v]) => ({ name, ...v }));
}

function calculateRiskScore(task: ApiTask, allTasks: ApiTask[], allHurdles: ApiHurdle[]): number {
  let score = 0;
  if (task.delayDays > 0) score += Math.min(task.delayDays * 3, 30);

  const deps = allTasks.filter((t) => task.dependencies?.includes(t.id));
  score += deps.filter((d) => d.status === "delayed" || d.status === "blocked").length * 15;

  const towerHurdles = allHurdles.filter((h) => {
    const affected = allTasks.find((t) => t.id === h.affectedTaskId);
    return affected?.towerId === task.towerId && h.status !== "resolved";
  });
  score += towerHurdles.length * 10;
  score += towerHurdles.filter((h) => h.severity === "critical").length * 10;

  if (task.startDate && task.endDate) {
    const start = new Date(task.startDate).getTime();
    const end = new Date(task.endDate).getTime();
    const now = Date.now();
    const totalDuration = end - start;
    if (totalDuration > 0) {
      const expected = Math.min(100, Math.max(0, ((now - start) / totalDuration) * 100));
      const gap = expected - task.progress;
      if (gap > 20) score += 20;
      else if (gap > 10) score += 10;
    }
  }

  if (task.criticalPath) score = Math.round(score * 1.3);
  if (task.status === "blocked") score += 25;
  if (task.status === "delayed") score += 20;

  return Math.min(100, Math.max(0, score));
}

function riskLabel(score: number) {
  return score >= 60 ? "High Risk" : score >= 30 ? "Medium Risk" : "Low Risk";
}

function getPredictions(ctx: LiveContext) {
  return ctx.tasks
    .filter((t) => t.status !== "completed")
    .map((task) => ({ task, score: calculateRiskScore(task, ctx.tasks, ctx.hurdles) }))
    .sort((a, b) => b.score - a.score);
}

const CHART_WORDS = /(chart|graph|plot|visuali[sz]e|pie|bar\s?chart|breakdown)/;

function findProject(q: string, projects: ApiProject[]) {
  return projects.find((p) => {
    const pName = p.name.toLowerCase();
    const firstWord = pName.split(" ")[0];
    return q.includes(pName) || (firstWord.length > 2 && q.includes(firstWord));
  });
}

function findTower(q: string, towers: ApiTower[]) {
  return towers.find((t) => q.includes(t.name.toLowerCase()));
}

function findDepartment(q: string, tasks: ApiTask[]) {
  const depts = Array.from(new Set(tasks.map((t) => t.department).filter(Boolean)));
  return depts.find((d) => q.includes(d.toLowerCase()));
}

const STATUS_WORD_RE = "(completed|in progress|delayed|blocked|not started|review|ready)";

function tasksByStatusWord(list: ApiTask[], statusWord: string) {
  if (statusWord === "in progress") return list.filter((t) => !["completed", "delayed", "blocked"].includes(t.status));
  return list.filter((t) => t.status === statusWord.replace(" ", "_"));
}

type LocalAnswer = { text: string; chart?: ChartSpec; charts?: ChartSpec[] };
type Matcher = (q: string, ctx: LiveContext) => LocalAnswer | null;

/* -------------------------------------------------------------------------
 * DRILL-DOWN MATCHERS
 * ---------------------------------------------------------------------- */
const matchTaskDetail: Matcher = (q, ctx) => {
  if (!/(full details on|details on)/.test(q)) return null;
  const task = ctx.tasks.find((t) => q.includes(t.title.toLowerCase()));
  if (!task) return null;
  const project = ctx.projects.find((p) => p.id === task.projectId);
  const tower = ctx.towers.find((t) => t.id === task.towerId);
  const score = calculateRiskScore(task, ctx.tasks, ctx.hurdles);
  const checklistTotal = task.checklist?.length ?? 0;
  const checklistDone = task.checklist?.filter((c) => c.completed).length ?? 0;

  const lines = [
    `**${task.title}**`,
    task.description || "No description provided.",
    `Project: ${project?.name ?? "—"} · Tower: ${tower?.name ?? "Project level"} · Department: ${task.department || "General"}`,
    `Status: ${(task.status || "not_started").replace("_", " ")} · Priority: ${task.priority} · Progress: ${task.progress}%`,
    `Risk score: **${score}** (${riskLabel(score)})`,
    task.delayDays > 0
      ? `Delayed by **${task.delayDays} day(s)**${task.delayReason ? ` — ${task.delayReason}` : ""}`
      : "No delays recorded.",
    task.criticalPath ? "⚠️ This task is on the critical path." : "",
    checklistTotal ? `Checklist: ${checklistDone}/${checklistTotal} complete.` : "",
  ].filter(Boolean);

  return { text: lines.join("\n") };
};

const matchRiskLevelDeptExplain: Matcher = (q, ctx) => {
  const m = q.match(/(high|medium|low)\s+risk\s+tasks\s+in\s+(.+)/);
  if (!m) return null;
  const level = m[1] as "high" | "medium" | "low";
  const dept = findDepartment(q, ctx.tasks);
  if (!dept) return null;

  const preds = getPredictions(ctx).filter((p) => (p.task.department || "General") === dept);
  const levelTasks = preds.filter((p) =>
    level === "high" ? p.score >= 60 : level === "medium" ? p.score >= 30 && p.score < 60 : p.score < 30
  );
  const label = level === "high" ? "High Risk" : level === "medium" ? "Medium Risk" : "Low Risk";
  const explain = {
    high: "stacking up multiple risk factors: timeline slippage, delayed dependencies, and active hurdles.",
    medium: "showing moderate delay or minor progress gaps without severe compounding blocks.",
    low: "tracking expected schedules with dependencies clear and no blocking hurdles.",
  }[level];

  if (levelTasks.length === 0) {
    return { text: `No ${label} tasks in **${dept}** right now — this group is ${explain}` };
  }

  const text =
    `**${levelTasks.length} ${label} task(s)** in **${dept}** (${explain}):\n\n` +
    levelTasks.map((p) => `• ${p.task.title} — score **${p.score}**${p.task.delayDays > 0 ? `, +${p.task.delayDays}d delay` : ""}`).join("\n");

  const color = level === "high" ? "hsl(0, 72%, 51%)" : level === "medium" ? "hsl(38, 92%, 50%)" : "hsl(152, 60%, 42%)";
  const chart: ChartSpec = {
    kind: "bar",
    title: `${label} Tasks — ${dept}`,
    layout: "vertical",
    data: levelTasks.map((p) => ({
      name: p.task.title.length > 16 ? p.task.title.slice(0, 16) + "…" : p.task.title,
      _fullLabel: p.task.title,
      score: p.score,
    })),
    bars: [{ key: "score", name: "Risk Score", color, drillTemplate: "Give me full details on {label}" }],
  };
  return { text, chart };
};

const matchStatusExplainInDept: Matcher = (q, ctx) => {
  const re = new RegExp(`${STATUS_WORD_RE}\\s+tasks\\s+in\\s+(.+)`);
  const m = q.match(re);
  if (!m) return null;
  const statusWord = m[1];
  const dept = findDepartment(q, ctx.tasks);
  if (!dept) return null;

  const dTasks = ctx.tasks.filter((t) => (t.department || "General") === dept);
  const filtered = tasksByStatusWord(dTasks, statusWord);
  const total = dTasks.length;
  const pct = total ? Math.round((filtered.length / total) * 100) : 0;

  const text =
    `**${filtered.length} of ${total} task(s) (${pct}%)** in **${dept}** are ${statusWord}.\n\n` +
    (filtered.length ? filtered.slice(0, 10).map((t) => `• ${t.title}${t.delayDays > 0 ? ` — +${t.delayDays}d` : ""}`).join("\n") : "");

  const chart: ChartSpec | undefined = filtered.length
    ? {
        kind: "pie",
        title: `${statusWord} tasks — ${dept}`,
        data: [
          { name: statusWord, value: filtered.length, color: statusColorMap[statusWord.replace(" ", "_")] || "hsl(220, 14%, 70%)" },
          { name: "Other", value: total - filtered.length, color: "hsl(220, 14%, 90%)" },
        ],
      }
    : undefined;
  return { text, chart };
};

const matchStatusExplainGlobal: Matcher = (q, ctx) => {
  const re = new RegExp(`^explain\\s+${STATUS_WORD_RE}\\s+tasks\\s*$`);
  const m = q.match(re);
  if (!m) return null;
  const statusWord = m[1];
  const filtered = tasksByStatusWord(ctx.tasks, statusWord);

  if (filtered.length === 0) {
    return { text: `No active tasks are currently marked as **${statusWord}** across your projects.` };
  }

  const projectMap = new Map(ctx.projects.map((p) => [p.id, p.name]));
  const text =
    `**${filtered.length} task(s)** across existing projects are ${statusWord}.\n\n` +
    filtered.slice(0, 10).map((t) => `• ${t.title} (${projectMap.get(t.projectId) ?? "—"})${t.delayDays > 0 ? ` — +${t.delayDays}d` : ""}`).join("\n");

  const byDept: Record<string, number> = {};
  filtered.forEach((t) => {
    const d = t.department || "General";
    byDept[d] = (byDept[d] || 0) + 1;
  });

  const chart: ChartSpec | undefined = Object.keys(byDept).length
    ? {
        kind: "bar",
        title: `${statusWord} Tasks by Department`,
        layout: "vertical",
        data: Object.entries(byDept).map(([name, value]) => ({ name, value })),
        bars: [{ key: "value", name: "Tasks", color: statusColorMap[statusWord.replace(" ", "_")] || "hsl(220, 14%, 70%)", drillTemplate: `Explain ${statusWord} tasks in {label}` }],
      }
    : undefined;
  return { text, chart };
};

/* -------------------------------------------------------------------------
 * TOP-LEVEL DYNAMIC MATCHERS
 * ---------------------------------------------------------------------- */
const matchMostDelayedProject: Matcher = (q, ctx) => {
  if (!/(most|which).*delay|delay.*(most|worst|highest)/.test(q)) return null;
  if (ctx.projects.length === 0) {
    return { text: "No active projects found in the system." };
  }

  const perProject = ctx.projects
    .map((p) => {
      const pTasks = ctx.tasks.filter((t) => t.projectId === p.id);
      return {
        project: p,
        totalDelay: pTasks.reduce((a, t) => a + (t.delayDays || 0), 0),
        delayedCount: pTasks.filter((t) => (t.delayDays || 0) > 0).length,
      };
    })
    .sort((a, b) => b.totalDelay - a.totalDelay);

  const top = perProject[0];
  if (!top || top.totalDelay === 0) {
    return { text: "None of your current projects show delay days — all active projects are tracking on schedule." };
  }

  const text = `**${top.project.name}** is currently the most delayed project, with **${top.totalDelay} cumulative delay day(s)** across **${top.delayedCount} task(s)**. Overall completion is at ${top.project.progress}%.`;
  const chart: ChartSpec = {
    kind: "bar",
    title: "Total Delay Days by Project",
    data: perProject.map((p) => ({ name: p.project.name.split(" ")[0], _fullLabel: p.project.name, delayDays: p.totalDelay })),
    bars: [{ key: "delayDays", name: "Delay Days", color: "hsl(0, 72%, 51%)", drillTemplate: "Tell me more about {label}" }],
  };
  return { text, chart };
};

const matchOverdueTasks: Matcher = (q, ctx) => {
  if (!/(overdue|delayed tasks|show.*delay|which tasks.*delay)/.test(q)) return null;
  const overdue = ctx.tasks.filter((t) => (t.delayDays || 0) > 0).sort((a, b) => b.delayDays - a.delayDays);
  if (overdue.length === 0) {
    return { text: "There are no overdue tasks right now across your existing projects — everything is tracking on time." };
  }

  const projectMap = new Map(ctx.projects.map((p) => [p.id, p.name]));
  const top = overdue.slice(0, 8);
  const text =
    `Found **${overdue.length} overdue task(s)**, totalling **${overdue.reduce((a, t) => a + t.delayDays, 0)} delay days**. Top delayed tasks:\n\n` +
    top.map((t) => `• ${t.title} (${projectMap.get(t.projectId) ?? "—"}) — +${t.delayDays}d${t.delayReason ? ` (${t.delayReason})` : ""}`).join("\n");

  const chart: ChartSpec = {
    kind: "bar",
    title: "Delay Days by Task",
    layout: "vertical",
    data: top.map((t) => ({ name: t.title.length > 18 ? t.title.slice(0, 18) + "…" : t.title, _fullLabel: t.title, delayDays: t.delayDays })),
    bars: [{ key: "delayDays", name: "Delay Days", color: "hsl(0, 72%, 51%)", drillTemplate: "Give me full details on {label}" }],
  };
  return { text, chart };
};

const matchHurdlesByTower: Matcher = (q, ctx) => {
  if (!/hurdle/.test(q)) return null;
  const tower = findTower(q, ctx.towers);
  const severityMatch = (["critical", "high", "medium", "low"] as const).find((s) => q.includes(`${s} severity`));

  const base = tower
    ? ctx.hurdles.filter((h) => h.affectedTower?.toLowerCase().includes(tower.name.toLowerCase()))
    : ctx.hurdles.filter((h) => h.status !== "resolved");

  const relevant = severityMatch ? base.filter((h) => h.severity === severityMatch) : base;
  const label = tower ? tower.name : "all active projects (open hurdles)";

  if (relevant.length === 0) {
    return { text: `No${severityMatch ? ` ${severityMatch} severity` : ""} open hurdles are currently logged for ${label}.` };
  }

  const text =
    `**${relevant.length} hurdle(s)**${severityMatch ? ` (${severityMatch} severity)` : ""} for ${label}:\n\n` +
    relevant.slice(0, 8).map((h) => `• ${h.title} — ${h.severity} severity, ${h.status.replace("_", " ")}, ${h.impactDays}d impact`).join("\n");

  const bySeverity = ["critical", "high", "medium", "low"]
    .map((sev) => ({ name: sev, value: base.filter((h) => h.severity === sev).length, color: severityColor[sev], drillQuery: `Show ${sev} severity hurdles for ${label}` }))
    .filter((d) => d.value > 0);

  const chart: ChartSpec | undefined = bySeverity.length ? { kind: "pie", title: `Hurdles by Severity — ${label}`, data: bySeverity } : undefined;
  return { text, chart };
};

const matchDelayRisk: Matcher = (q, ctx) => {
  if (!/(predict|risk)/.test(q)) return null;
  const preds = getPredictions(ctx);
  if (preds.length === 0) {
    return { text: "Not enough data available to generate a reliable prediction. Please ensure active projects and tasks are populated." };
  }

  const top = preds.slice(0, 6);
  const text = "Top delay-risk tasks across existing projects:\n\n" + top.map((p) => `• ${p.task.title} — score **${p.score}** (${riskLabel(p.score)})`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Risk Score by Task",
    layout: "vertical",
    data: top.map((p) => ({ name: p.task.title.length > 18 ? p.task.title.slice(0, 18) + "…" : p.task.title, _fullLabel: p.task.title, score: p.score })),
    bars: [{ key: "score", name: "Risk Score", color: "hsl(0, 72%, 51%)", drillTemplate: "Give me full details on {label}" }],
  };
  return { text, chart };
};

const matchRiskByDepartment: Matcher = (q, ctx) => {
  if (!/risk.*(department|dept)/.test(q)) return null;
  const preds = getPredictions(ctx);
  if (preds.length === 0) {
    return { text: "No active tasks found to evaluate department risk." };
  }

  const byDept: Record<string, { high: number; medium: number; low: number }> = {};
  preds.forEach((p) => {
    const d = p.task.department || "General";
    if (!byDept[d]) byDept[d] = { high: 0, medium: 0, low: 0 };
    if (p.score >= 60) byDept[d].high++;
    else if (p.score >= 30) byDept[d].medium++;
    else byDept[d].low++;
  });

  const data = Object.entries(byDept).map(([name, v]) => ({ name, ...v }));
  const text = "Risk breakdown by department (High / Medium / Low task counts):\n\n" + data.map((d) => `• ${d.name}: ${d.high} high, ${d.medium} medium, ${d.low} low`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Risk by Department",
    layout: "vertical",
    stacked: true,
    data,
    bars: [
      { key: "high", name: "High", color: "hsl(0, 72%, 51%)", drillTemplate: "Explain {seriesName} risk tasks in {label}" },
      { key: "medium", name: "Medium", color: "hsl(38, 92%, 50%)", drillTemplate: "Explain {seriesName} risk tasks in {label}" },
      { key: "low", name: "Low", color: "hsl(152, 60%, 42%)", drillTemplate: "Explain {seriesName} risk tasks in {label}" },
    ],
  };
  return { text, chart };
};

const matchDelayByProject: Matcher = (q, ctx) => {
  if (!/(delay analysis|delay.*project|project.*delay)/.test(q)) return null;
  if (ctx.projects.length === 0) return { text: "No active projects found." };

  const data = ctx.projects.map((p) => {
    const pTasks = ctx.tasks.filter((t) => t.projectId === p.id);
    return {
      name: p.name.split(" ")[0],
      _fullLabel: p.name,
      delayed: pTasks.filter((t) => (t.delayDays || 0) > 0).length,
      totalDelay: pTasks.reduce((a, t) => a + (t.delayDays || 0), 0),
    };
  });

  const text = "Delay analysis across current projects:\n\n" + data.map((d) => `• ${d._fullLabel}: ${d.delayed} delayed task(s), ${d.totalDelay} total delay days`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Delay Analysis by Project",
    data,
    bars: [
      { key: "delayed", name: "Delayed Tasks", color: "hsl(0, 72%, 51%)", drillTemplate: "Tell me more about {label}" },
      { key: "totalDelay", name: "Total Delay Days", color: "hsl(38, 92%, 50%)", drillTemplate: "Tell me more about {label}" },
    ],
  };
  return { text, chart };
};

const matchDepartmentPerformance: Matcher = (q, ctx) => {
  if (!/department performance|department.*(completed|progress)/.test(q)) return null;
  const data = buildDeptStatusBars(ctx.tasks);
  if (data.length === 0) return { text: "No department task records available in active projects." };

  const text = "Department performance (completed / in progress / delayed):\n\n" + data.map((d) => `• ${d.name}: ${d.completed} completed, ${d.inProgress} in progress, ${d.delayed} delayed`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Department Performance",
    stacked: true,
    data,
    bars: [
      { key: "completed", name: "Completed", color: "hsl(152, 60%, 42%)", drillTemplate: "Explain {seriesName} tasks in {label}" },
      { key: "inProgress", name: "In Progress", color: "hsl(38, 92%, 50%)", drillTemplate: "Explain {seriesName} tasks in {label}" },
      { key: "delayed", name: "Delayed", color: "hsl(0, 72%, 51%)", drillTemplate: "Explain {seriesName} tasks in {label}" },
    ],
  };
  return { text, chart };
};

const matchStatusDistribution: Matcher = (q, ctx) => {
  if (!/(status distribution|task status|status breakdown)/.test(q)) return null;
  const data = buildStatusPieData(ctx.tasks);
  if (data.length === 0) return { text: "No active tasks recorded to display status distribution." };

  const text = "Current task status distribution across active projects:\n\n" + data.map((d) => `• ${d.name}: ${d.value}`).join("\n");
  return { text, chart: { kind: "pie", title: "Task Status Distribution", data } };
};

const matchProgressSummary: Matcher = (q, ctx) => {
  if (!/(progress summary|overall progress|status summary|how.*(is|are).*progress)/.test(q)) return null;
  if (ctx.projects.length === 0) return { text: "No active projects available in your workspace." };

  const total = ctx.tasks.length;
  const completed = ctx.tasks.filter((t) => t.status === "completed").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const text = `Portfolio overall completion is **${pct}%** (${completed}/${total} active tasks completed). Current projects:\n\n` +
    ctx.projects.map((p) => `• **${p.name}**: ${p.progress}% (${p.status || "Active"})`).join("\n");

  const chart: ChartSpec = {
    kind: "bar",
    title: "Progress by Current Project",
    data: ctx.projects.map((p) => ({ name: p.name.split(" ")[0], _fullLabel: p.name, progress: p.progress })),
    bars: [{ key: "progress", name: "Progress %", color: "hsl(224, 76%, 48%)", drillTemplate: "Tell me more about {label}" }],
  };
  return { text, chart };
};

const matchProjectSummary: Matcher = (q, ctx) => {
  const project = findProject(q, ctx.projects);
  if (!project) return null;

  const pTasks = ctx.tasks.filter((t) => t.projectId === project.id);
  const delayed = pTasks.filter((t) => (t.delayDays || 0) > 0);
  const totalDelayDays = delayed.reduce((a, t) => a + (t.delayDays || 0), 0);

  const text = `**${project.name}** (${project.location || "Site"}) — **${project.progress}%** complete, status: **${project.status || "Active"}**.\n\n` +
    `• Total Tasks: **${pTasks.length}**\n` +
    `• Delayed Tasks: **${delayed.length}** (${totalDelayDays} total delay days)\n` +
    `• RERA Number: **${project.reraNumber || "N/A"}**`;

  const statusPie: ChartSpec = {
    kind: "pie",
    title: `${project.name} — Task Status`,
    data: buildStatusPieData(pTasks, project.name),
  };

  const projectTowers = ctx.towers.filter((t) => t.projectId === project.id);
  const towerProgressBar: ChartSpec | undefined = projectTowers.length
    ? {
        kind: "bar",
        title: `${project.name} — Progress by Tower`,
        data: projectTowers.map((t) => ({ name: t.name, _fullLabel: t.name, progress: t.progress })),
        bars: [{ key: "progress", name: "Progress %", color: "hsl(224, 76%, 48%)" }],
      }
    : undefined;

  const deptData = buildDeptStatusBars(pTasks);
  const deptBar: ChartSpec | undefined = deptData.length
    ? {
        kind: "bar",
        title: `${project.name} — Department Breakdown`,
        layout: "vertical",
        stacked: true,
        data: deptData,
        bars: [
          { key: "completed", name: "Completed", color: "hsl(152, 60%, 42%)" },
          { key: "inProgress", name: "In Progress", color: "hsl(38, 92%, 50%)" },
          { key: "delayed", name: "Delayed", color: "hsl(0, 72%, 51%)" },
        ],
      }
    : undefined;

  const charts = [statusPie, towerProgressBar, deptBar].filter(Boolean) as ChartSpec[];
  return { text, charts };
};

const matchDepartmentSummary: Matcher = (q, ctx) => {
  const dept = findDepartment(q, ctx.tasks);
  if (!dept) return null;
  const dTasks = ctx.tasks.filter((t) => (t.department || "General") === dept);
  const completed = dTasks.filter((t) => t.status === "completed").length;
  const delayed = dTasks.filter((t) => t.status === "delayed" || t.status === "blocked").length;
  const text = `**${dept}** has ${dTasks.length} task(s): ${completed} completed, ${delayed} delayed/blocked, ${dTasks.reduce((a, t) => a + (t.delayDays || 0), 0)} total delay days.`;
  return { text, chart: { kind: "pie", title: `${dept} — Task Status`, data: buildStatusPieData(dTasks, dept) } };
};

const matchTowerSummary: Matcher = (q, ctx) => {
  const tower = findTower(q, ctx.towers);
  if (!tower) return null;
  const tTasks = ctx.tasks.filter((t) => t.towerId === tower.id);
  const text = `**${tower.name}** is currently at **${tower.progress}%** progress (${tower.status || "In Construction"}), with ${tTasks.length} task(s) across ${tower.totalFloors || 0} floors.`;
  return { text, chart: { kind: "pie", title: `${tower.name} — Task Status`, data: buildStatusPieData(tTasks, tower.name) } };
};

const matchers: Matcher[] = [
  matchTaskDetail,
  matchRiskLevelDeptExplain,
  matchStatusExplainInDept,
  matchStatusExplainGlobal,
  matchMostDelayedProject,
  matchOverdueTasks,
  matchHurdlesByTower,
  matchDelayRisk,
  matchRiskByDepartment,
  matchDelayByProject,
  matchDepartmentPerformance,
  matchStatusDistribution,
  matchProgressSummary,
  matchProjectSummary,
  matchDepartmentSummary,
  matchTowerSummary,
];

function resolveLocalAnswer(rawQuery: string, ctx: LiveContext): LocalAnswer | null {
  const q = rawQuery.toLowerCase().trim();
  for (const matcher of matchers) {
    const result = matcher(q, ctx);
    if (result) {
      if (CHART_WORDS.test(q) && !result.chart && !result.charts?.length) {
        return { ...result, chart: { kind: "pie", title: "Task Status Distribution", data: buildStatusPieData(ctx.tasks) } };
      }
      return result;
    }
  }
  if (CHART_WORDS.test(q)) {
    if (ctx.tasks.length === 0) {
      return {
        text: "Not enough data available to generate a reliable chart. No active tasks found.",
      };
    }
    return {
      text: "Here is the current task status distribution for your active projects:",
      chart: { kind: "pie", title: "Task Status Distribution", data: buildStatusPieData(ctx.tasks) },
    };
  }
  return null;
}

function buildGroundingContext(ctx: LiveContext): string {
  const total = ctx.tasks.length;
  const completed = ctx.tasks.filter((t) => t.status === "completed").length;
  const delayed = ctx.tasks.filter((t) => (t.delayDays || 0) > 0).length;
  const openHurdles = ctx.hurdles.filter((h) => h.status !== "resolved").length;
  const depts = Array.from(new Set(ctx.tasks.map((t) => t.department).filter(Boolean)));

  return [
    "You are answering strictly from the following live, active project data. Do not invent numbers or names not listed here.",
    `Active Projects: ${ctx.projects.length ? ctx.projects.map((p) => `${p.name} (${p.progress}% complete, ${p.status || "Active"})`).join("; ") : "None"}`,
    `Towers: ${ctx.towers.length ? ctx.towers.map((t) => t.name).join(", ") : "None"}`,
    `Departments: ${depts.join(", ") || "None"}`,
    `Totals: ${total} tasks, ${completed} completed, ${delayed} delayed, ${openHurdles} open hurdles.`,
  ].join("\n");
}

/* =========================================================================
 * 4. MAIN COMPONENT
 * ===================================================================== */
const navTopics: { label: string; icon: LucideIcon; query: string }[] = [
  { label: "Projects", icon: Building2, query: "Give me a progress summary" },
  { label: "Risk", icon: AlertTriangle, query: "Predict next delay risk" },
  { label: "Delays", icon: Clock, query: "Show overdue tasks" },
  { label: "Hurdles", icon: Construction, query: "Show hurdles affecting a tower" },
  { label: "Departments", icon: Users, query: "Department performance chart" },
  { label: "Risk by Dept", icon: Activity, query: "Show risk by department as a chart" },
  { label: "Status", icon: PieChartIcon, query: "Task status distribution pie chart" },
];

type DrillStep = { query: string; label: string; answer: LocalAnswer };

const AIAssistant = () => {
  const { user } = useAuth();

  // ── Live Data Queries ──
  const { data: rawProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
  const { data: rawTasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
  });
  const { data: rawHurdles = [], isLoading: hurdlesLoading, refetch: refetchHurdles } = useQuery({
    queryKey: ["hurdles"],
    queryFn: hurdlesApi.list,
  });
  const { data: rawTowers = [], isLoading: towersLoading, refetch: refetchTowers } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list,
  });

  // Filter strictly by active / existing projects
  const liveContext: LiveContext = useMemo(() => {
    const projects = rawProjects.filter(
      (p) => p && p.status?.toLowerCase() !== "deleted" && p.status?.toLowerCase() !== "archived"
    );
    const activeProjectIds = new Set(projects.map((p) => p.id));
    const tasks = rawTasks.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
    const towers = rawTowers.filter((t) => t.projectId && activeProjectIds.has(t.projectId));
    const hurdles = rawHurdles.filter((h) => {
      if (h.affectedTaskId) return tasks.some((t) => t.id === h.affectedTaskId);
      return true;
    });

    return { projects, tasks, towers, hurdles };
  }, [rawProjects, rawTasks, rawTowers, rawHurdles]);

  const refreshAll = () => {
    refetchProjects();
    refetchTasks();
    refetchHurdles();
    refetchTowers();
  };

  const getStorageKey = () => (user ? `ai_chat_messages_${user.id}` : "ai_chat_messages_guest");
  const getDrillStorageKey = () => (user ? `ai_drill_stack_${user.id}` : "ai_drill_stack_guest");

  const buildInitialMessage = (): ChatMessage => {
    if (liveContext.projects.length > 0) {
      const sampleProj = liveContext.projects[0].name;
      return {
        role: "assistant",
        text: `Hello! I'm your **Project Intelligence AI Assistant**. I provide real-time reports, delay predictions, and live charts based **strictly on your current active projects**.\n\nTry asking: "Tell me about ${sampleProj}", "Predict next delay risk", or "Department performance chart". You can tap on any chart bar or slice to drill into details. What would you like to explore?`,
        grounded: true,
      };
    }
    return {
      role: "assistant",
      text: "Hello! I'm your **Project Intelligence AI Assistant**. There are currently no active projects in your workspace. Once you add projects and tasks, I will provide live progress metrics, risk predictions, and interactive reports.",
      grounded: true,
    };
  };

  const loadMessages = (): ChatMessage[] => {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    return [buildInitialMessage()];
  };

  const loadDrillStack = (): DrillStep[] => {
    try {
      const stored = localStorage.getItem(getDrillStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [drillStack, setDrillStack] = useState<DrillStep[]>(loadDrillStack());
  const [drillOpen, setDrillOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(messages));
  }, [messages, user]);

  useEffect(() => {
    setMessages(loadMessages());
  }, [user]);

  useEffect(() => {
    localStorage.setItem(getDrillStorageKey(), JSON.stringify(drillStack));
  }, [drillStack, user]);

  const clearChat = () => {
    setMessages([buildInitialMessage()]);
  };

  const openDrill = (query: string) => {
    const answer = resolveLocalAnswer(query, liveContext);
    if (!answer) return;
    const label = answer.chart?.title || answer.charts?.[0]?.title || (query.length > 32 ? query.slice(0, 32) + "…" : query);
    setDrillStack((prev) => [...prev, { query, label, answer }]);
    setDrillOpen(true);
  };

  const drillBack = () => {
    setDrillStack((prev) => {
      if (prev.length <= 1) {
        setDrillOpen(false);
        return prev;
      }
      return prev.slice(0, -1);
    });
  };

  const jumpToDrillLevel = (index: number) => {
    setDrillStack((prev) => prev.slice(0, index + 1));
  };

  const clearDrill = () => {
    setDrillStack([]);
    setDrillOpen(false);
  };

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || sending) return;

    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setInput("");

    const local = resolveLocalAnswer(msg, liveContext);
    if (local) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: local.text, chart: local.chart, charts: local.charts, grounded: true },
      ]);
      return;
    }

    setSending(true);
    try {
      const context = buildGroundingContext(liveContext);
      const { response } = await analyticsApi.aiAssistant(`${context}\n\nUser question: ${msg}`);
      setMessages((prev) => [...prev, { role: "assistant", text: response, grounded: false }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof ApiError ? `Sorry, I couldn't process that: ${err.message}` : "Sorry, I couldn't reach the server. Is the backend running?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Dynamic suggestions based on active projects
  const suggestions = useMemo(() => {
    const list = [
      "Which project is most delayed?",
      "Show overdue tasks",
      "Predict next delay risk",
      "Give me a progress summary",
      "Show risk by department as a chart",
      "Department performance chart",
      "Task status distribution pie chart",
    ];
    if (liveContext.projects.length > 0) {
      list.push(`Tell me about ${liveContext.projects[0].name}`);
      if (liveContext.projects.length > 1) {
        list.push(`Tell me about ${liveContext.projects[1].name}`);
      }
    }
    return list;
  }, [liveContext.projects]);

  const currentDrill = drillStack[drillStack.length - 1];
  const isLoading = projectsLoading || tasksLoading;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">AI Assistant</h1>
          <p className="text-muted-foreground mt-1">
            Real-time project intelligence grounded in your active projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refreshAll} title="Refresh live data">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {drillStack.length > 0 && !drillOpen && (
            <Button variant="outline" size="sm" onClick={() => setDrillOpen(true)}>
              <History className="h-4 w-4 mr-1" />
              Resume drill-down ({drillStack.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Chat
          </Button>
        </div>
      </div>

      {/* Quick-topic navigation buttons */}
      <div className="flex flex-wrap gap-2">
        {navTopics.map((topic) => (
          <button
            key={topic.label}
            onClick={() => send(topic.query)}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <topic.icon className="h-3.5 w-3.5 text-primary" />
            {topic.label}
          </button>
        ))}
      </div>

      <Card className="min-h-[500px] flex flex-col">
        <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <AnswerBody text={msg.text} chart={msg.chart} charts={msg.charts} onDrillQuery={openDrill} />
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-muted-foreground">Thinking…</div>
            </div>
          )}
        </CardContent>
        <div className="border-t p-4">
          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your projects, or say 'as a chart'…"
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
            />
            <Button size="icon" onClick={() => send()} disabled={sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Drill-down modal */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2 shrink-0" onClick={drillBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="font-display text-lg text-left">{currentDrill?.label ?? "Details"}</DialogTitle>
            </div>
          </DialogHeader>

          {drillStack.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground -mt-2">
              {drillStack.map((step, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  <button
                    onClick={() => jumpToDrillLevel(idx)}
                    className={`hover:underline ${idx === drillStack.length - 1 ? "text-foreground font-medium" : ""}`}
                  >
                    {step.label}
                  </button>
                </span>
              ))}
            </div>
          )}

          {currentDrill && (
            <div className="text-sm">
              <AnswerBody
                text={currentDrill.answer.text}
                chart={currentDrill.answer.chart}
                charts={currentDrill.answer.charts}
                onDrillQuery={openDrill}
              />
            </div>
          )}

          <div className="flex justify-end pt-2 border-t mt-2">
            <Button variant="ghost" size="sm" onClick={clearDrill} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear drill history
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAssistant;