import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, Trash2, ArrowLeft, ChevronRight, History,
  Building2, AlertTriangle, Clock, Construction, Users, Activity,
  PieChart as PieChartIcon, type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { analyticsApi, ApiError } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  tasks, hurdles, projects, towers, departmentStats,
  getProjectById, type Task,
} from "@/data/demo-data";

/* =========================================================================
 * 1. CHART SPEC
 * -------------------------------------------------------------------------
 * Every bar / pie datum can optionally carry drill-down info:
 *   - Bar series: `drillTemplate` is a string with {label} / {seriesName}
 *     placeholders. On click we build a natural-language follow-up
 *     question and "ask" it via send(), which re-enters the local answer
 *     engine below (resolveLocalAnswer) — that's how a click "goes inside"
 *     a chart and gets a deeper, more specific answer + chart.
 *   - Pie slices: `drillQuery` is the fully-formed follow-up question.
 *   - Bar rows can carry `_fullLabel` when the visible `name` is truncated
 *     (e.g. long task titles) so the follow-up question uses the real name.
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
  // A message/answer can now surface *several* charts at once (e.g. a project
  // summary showing status pie + progress-by-tower bar + department bar
  // together), instead of being limited to one visual per answer.
  charts?: ChartSpec[];
  grounded?: boolean;
};

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
  if (chart.kind === "pie") {
    const drillable = chart.data.some((d) => d.drillQuery);
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs font-medium mb-2">{chart.title}</p>
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
        <p className="text-xs font-medium mb-2">{chart.title}</p>
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
      <p className="text-xs font-medium mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={vertical ? Math.max(160, chart.data.length * 34 + 20) : 220}>
        <BarChart data={chart.data} layout={vertical ? "vertical" : "horizontal"} margin={{ left: vertical ? 8 : 0, bottom: vertical ? 0 : 28 }}>
          {vertical ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={78} />
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

// Renders the text body plus every chart attached to an answer/message.
// `charts` (array) takes priority when present; falls back to the single
// `chart` field for matchers that only ever produce one visual.
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
      <div className="whitespace-pre-line">
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
 * 3. LOCAL DATA ENGINE — matchers, helpers, and drill-down matchers
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

function buildStatusPieData(list: Task[], contextLabel?: string) {
  const byStatus: Record<string, number> = {};
  list.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
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

// Builds the completed / in-progress / delayed stacked-bar dataset for a
// given task list, grouped by department. Reused by the project summary so
// "Skyline" (etc.) can show this alongside its status pie.
function buildDeptStatusBars(list: Task[]) {
  const byDept: Record<string, { completed: number; inProgress: number; delayed: number }> = {};
  list.forEach((t) => {
    if (!byDept[t.department]) byDept[t.department] = { completed: 0, inProgress: 0, delayed: 0 };
    if (t.status === "completed") byDept[t.department].completed++;
    else if (t.status === "delayed" || t.status === "blocked") byDept[t.department].delayed++;
    else byDept[t.department].inProgress++;
  });
  return Object.entries(byDept).map(([name, v]) => ({ name, ...v }));
}

function calculateRiskScore(task: Task): number {
  let score = 0;
  if (task.delayDays > 0) score += Math.min(task.delayDays * 3, 30);

  const deps = tasks.filter((t) => task.dependencies?.includes(t.id));
  score += deps.filter((d) => d.status === "delayed" || d.status === "blocked").length * 15;

  const towerHurdles = hurdles.filter((h) => {
    const affected = tasks.find((t) => t.id === h.affectedTaskId);
    return affected?.towerId === task.towerId && h.status !== "resolved";
  });
  score += towerHurdles.length * 10;
  score += towerHurdles.filter((h) => h.severity === "critical").length * 10;

  if (task.startDate && task.endDate) {
    const start = new Date(task.startDate).getTime();
    const end = new Date(task.endDate).getTime();
    const now = Date.now();
    const expected = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const gap = expected - task.progress;
    if (gap > 20) score += 20;
    else if (gap > 10) score += 10;
  }

  if (task.criticalPath) score = Math.round(score * 1.3);
  if (task.status === "blocked") score += 25;
  if (task.status === "delayed") score += 20;

  return Math.min(100, Math.max(0, score));
}

function riskLabel(score: number) {
  return score >= 60 ? "High Risk" : score >= 30 ? "Medium Risk" : "Low Risk";
}

function getPredictions() {
  return tasks
    .filter((t) => t.status !== "completed")
    .map((task) => ({ task, score: calculateRiskScore(task) }))
    .sort((a, b) => b.score - a.score);
}

const CHART_WORDS = /(chart|graph|plot|visuali[sz]e|pie|bar\s?chart|breakdown)/;

function findProject(q: string) {
  return projects.find((p) => q.includes(p.name.toLowerCase()) || q.includes(p.name.toLowerCase().split(" ")[0]));
}
function findTower(q: string) {
  return towers.find((t) => q.includes(t.name.toLowerCase()));
}
function findDepartment(q: string) {
  const depts = Array.from(new Set(tasks.map((t) => t.department)));
  return depts.find((d) => q.includes(d.toLowerCase()));
}

const STATUS_WORD_RE = "(completed|in progress|delayed|blocked|not started|review|ready)";

function tasksByStatusWord(list: Task[], statusWord: string) {
  if (statusWord === "in progress") return list.filter((t) => !["completed", "delayed", "blocked"].includes(t.status));
  return list.filter((t) => t.status === statusWord.replace(" ", "_"));
}

type LocalAnswer = { text: string; chart?: ChartSpec; charts?: ChartSpec[] };
type Matcher = (q: string) => LocalAnswer | null;

/* -------------------------------------------------------------------------
 * DRILL-DOWN MATCHERS (innermost first) — these handle the follow-up
 * questions synthesized when a user taps a bar / pie slice in a chart.
 * ---------------------------------------------------------------------- */

// Deepest level: full detail on one specific task (terminal — no further chart).
const matchTaskDetail: Matcher = (q) => {
  if (!/(full details on|details on)/.test(q)) return null;
  const task = tasks.find((t) => q.includes(t.title.toLowerCase()));
  if (!task) return null;
  const project = getProjectById(task.projectId);
  const tower = towers.find((t) => t.id === task.towerId);
  const score = calculateRiskScore(task);
  const checklistTotal = task.checklist?.length ?? 0;
  const checklistDone = task.checklist?.filter((c) => c.completed).length ?? 0;

  const lines = [
    `**${task.title}**`,
    task.description,
    `Project: ${project?.name ?? "—"} · Tower: ${tower?.name ?? "—"} · Department: ${task.department}`,
    `Status: ${task.status.replace("_", " ")} · Priority: ${task.priority} · Progress: ${task.progress}%`,
    `Risk score: **${score}** (${riskLabel(score)})`,
    task.delayDays > 0
      ? `Delayed by **${task.delayDays} day(s)**${task.delayReason ? ` — ${task.delayReason}` : ""}`
      : "No delays recorded.",
    task.criticalPath ? "⚠️ This task is on the critical path." : "",
    checklistTotal ? `Checklist: ${checklistDone}/${checklistTotal} complete.` : "",
  ].filter(Boolean);

  return { text: lines.join("\n") };
};

// Explain High/Medium/Low risk tasks within a specific department.
const matchRiskLevelDeptExplain: Matcher = (q) => {
  const m = q.match(/(high|medium|low)\s+risk\s+tasks\s+in\s+(.+)/);
  if (!m) return null;
  const level = m[1] as "high" | "medium" | "low";
  const dept = findDepartment(q);
  if (!dept) return null;

  const preds = getPredictions().filter((p) => p.task.department === dept);
  const levelTasks = preds.filter((p) =>
    level === "high" ? p.score >= 60 : level === "medium" ? p.score >= 30 && p.score < 60 : p.score < 30
  );
  const label = level === "high" ? "High Risk" : level === "medium" ? "Medium Risk" : "Low Risk";
  const explain: Record<typeof level, string> = {
    high: "stacking up multiple red flags at once — a history of delays, dependencies that are themselves blocked or delayed, active hurdles on the same tower, and progress falling behind the expected pace. Critical-path tasks get an extra 1.3x weighting, since a slip here pushes out the whole schedule.",
    medium: "usually one or two things are off — a modest historical delay, a single blocked dependency, or a noticeable but not severe progress gap — without enough compounding factors to tip into High Risk yet.",
    low: "progress is roughly tracking the plan, dependencies are clear, and there are no active hurdles on the same tower dragging the score up. This is the healthy zone.",
  } as any;

  if (levelTasks.length === 0) {
    return { text: `No ${label} tasks in **${dept}** right now — that band is where ${explain[level]}` };
  }

  const text =
    `**${levelTasks.length} ${label} task(s)** in **${dept}** — that band is where ${explain[level]}\n\n` +
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

// Explain a specific status (completed/in progress/delayed/...) within a department.
const matchStatusExplainInDept: Matcher = (q) => {
  const re = new RegExp(`${STATUS_WORD_RE}\\s+tasks\\s+in\\s+(.+)`);
  const m = q.match(re);
  if (!m) return null;
  const statusWord = m[1];
  const dept = findDepartment(q);
  if (!dept) return null;

  const dTasks = tasks.filter((t) => t.department === dept);
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

// Explain a specific status across the whole portfolio (no department clause).
const matchStatusExplainGlobal: Matcher = (q) => {
  const re = new RegExp(`^explain\\s+${STATUS_WORD_RE}\\s+tasks\\s*$`);
  const m = q.match(re);
  if (!m) return null;
  const statusWord = m[1];
  const filtered = tasksByStatusWord(tasks, statusWord);

  const text =
    `**${filtered.length} task(s)** across all projects are ${statusWord}.\n\n` +
    filtered.slice(0, 10).map((t) => `• ${t.title} (${getProjectById(t.projectId)?.name ?? "—"})${t.delayDays > 0 ? ` — +${t.delayDays}d` : ""}`).join("\n");

  const byDept: Record<string, number> = {};
  filtered.forEach((t) => { byDept[t.department] = (byDept[t.department] || 0) + 1; });
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
 * TOP-LEVEL MATCHERS (unchanged behaviour, now with drill metadata added
 * to their charts so you can tap into them)
 * ---------------------------------------------------------------------- */

const matchMostDelayedProject: Matcher = (q) => {
  if (!/(most|which).*delay|delay.*(most|worst|highest)/.test(q)) return null;
  const perProject = projects
    .map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id);
      return { project: p, totalDelay: pTasks.reduce((a, t) => a + t.delayDays, 0), delayedCount: pTasks.filter((t) => t.delayDays > 0).length };
    })
    .sort((a, b) => b.totalDelay - a.totalDelay);
  const top = perProject[0];
  if (!top || top.totalDelay === 0) return { text: "None of your projects currently show delay days — everything is tracking on schedule." };
  const text = `**${top.project.name}** is the most delayed project, with **${top.totalDelay} cumulative delay day(s)** across **${top.delayedCount} task(s)**. Overall completion is at ${top.project.progress}%.`;
  const chart: ChartSpec = {
    kind: "bar",
    title: "Total Delay Days by Project",
    data: perProject.map((p) => ({ name: p.project.name.split(" ")[0], _fullLabel: p.project.name, delayDays: p.totalDelay })),
    bars: [{ key: "delayDays", name: "Delay Days", color: "hsl(0, 72%, 51%)", drillTemplate: "Tell me more about {label}" }],
  };
  return { text, chart };
};

const matchOverdueTasks: Matcher = (q) => {
  if (!/(overdue|delayed tasks|show.*delay|which tasks.*delay)/.test(q)) return null;
  const overdue = tasks.filter((t) => t.delayDays > 0).sort((a, b) => b.delayDays - a.delayDays);
  if (overdue.length === 0) return { text: "There are no overdue tasks right now — everything is on schedule." };
  const top = overdue.slice(0, 8);
  const text =
    `There are **${overdue.length} overdue task(s)**, totalling **${overdue.reduce((a, t) => a + t.delayDays, 0)} delay days**. Top ones:\n` +
    top.map((t) => `• ${t.title} (${getProjectById(t.projectId)?.name ?? "—"}) — +${t.delayDays}d${t.delayReason ? `, ${t.delayReason}` : ""}`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Delay Days by Task",
    layout: "vertical",
    data: top.map((t) => ({ name: t.title.length > 16 ? t.title.slice(0, 16) + "…" : t.title, _fullLabel: t.title, delayDays: t.delayDays })),
    bars: [{ key: "delayDays", name: "Delay Days", color: "hsl(0, 72%, 51%)", drillTemplate: "Give me full details on {label}" }],
  };
  return { text, chart };
};

const matchHurdlesByTower: Matcher = (q) => {
  if (!/hurdle/.test(q)) return null;
  const tower = findTower(q);
  const severityMatch = (["critical", "high", "medium", "low"] as const).find((s) => q.includes(`${s} severity`));
  const base = tower
    ? hurdles.filter((h) => h.affectedTower?.toLowerCase().includes(tower.name.toLowerCase()))
    : hurdles.filter((h) => h.status !== "resolved");
  const relevant = severityMatch ? base.filter((h) => h.severity === severityMatch) : base;
  const label = tower ? tower.name : "all towers (open only)";
  if (relevant.length === 0) return { text: `No${severityMatch ? ` ${severityMatch} severity` : ""} hurdles are currently logged for ${label}.` };
  const text =
    `**${relevant.length} hurdle(s)**${severityMatch ? ` (${severityMatch} severity)` : ""} for ${label}:\n` +
    relevant.slice(0, 8).map((h) => `• ${h.title} — ${h.severity} severity, ${h.status.replace("_", " ")}, ${h.impactDays}d impact`).join("\n");
  const bySeverity = ["critical", "high", "medium", "low"]
    .map((sev) => ({ name: sev, value: base.filter((h) => h.severity === sev).length, color: severityColor[sev], drillQuery: `Show ${sev} severity hurdles for ${label}` }))
    .filter((d) => d.value > 0);
  const chart: ChartSpec | undefined = bySeverity.length ? { kind: "pie", title: `Hurdles by Severity — ${label}`, data: bySeverity } : undefined;
  return { text, chart };
};

const matchDelayRisk: Matcher = (q) => {
  if (!/(predict|risk)/.test(q)) return null;
  const preds = getPredictions().slice(0, 6);
  if (preds.length === 0) return { text: "No active tasks to score for risk right now." };
  const text = "Top delay-risk tasks right now:\n" + preds.map((p) => `• ${p.task.title} — score **${p.score}** (${riskLabel(p.score)})`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Risk Score by Task",
    layout: "vertical",
    data: preds.map((p) => ({ name: p.task.title.length > 16 ? p.task.title.slice(0, 16) + "…" : p.task.title, _fullLabel: p.task.title, score: p.score })),
    bars: [{ key: "score", name: "Risk Score", color: "hsl(0, 72%, 51%)", drillTemplate: "Give me full details on {label}" }],
  };
  return { text, chart };
};

const matchRiskByDepartment: Matcher = (q) => {
  if (!/risk.*(department|dept)/.test(q)) return null;
  const byDept: Record<string, { high: number; medium: number; low: number }> = {};
  getPredictions().forEach((p) => {
    const d = p.task.department;
    if (!byDept[d]) byDept[d] = { high: 0, medium: 0, low: 0 };
    if (p.score >= 60) byDept[d].high++;
    else if (p.score >= 30) byDept[d].medium++;
    else byDept[d].low++;
  });
  const data = Object.entries(byDept).map(([name, v]) => ({ name, ...v }));
  const text = "Risk breakdown by department (High / Medium / Low task counts):\n" + data.map((d) => `• ${d.name}: ${d.high} high, ${d.medium} medium, ${d.low} low`).join("\n");
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

const matchDelayByProject: Matcher = (q) => {
  if (!/(delay analysis|delay.*project|project.*delay)/.test(q)) return null;
  const data = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id);
    return { name: p.name.split(" ")[0], _fullLabel: p.name, delayed: pTasks.filter((t) => t.delayDays > 0).length, totalDelay: pTasks.reduce((a, t) => a + t.delayDays, 0) };
  });
  const text = "Delay analysis by project:\n" + data.map((d) => `• ${d._fullLabel}: ${d.delayed} delayed task(s), ${d.totalDelay} total delay days`).join("\n");
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

const matchDepartmentPerformance: Matcher = (q) => {
  if (!/department performance|department.*(completed|progress)/.test(q)) return null;
  const data = departmentStats as any[];
  const text = "Department performance (completed / in progress / delayed):\n" + data.map((d) => `• ${d.name}: ${d.completed} completed, ${d.inProgress} in progress, ${d.delayed} delayed`).join("\n");
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

const matchStatusDistribution: Matcher = (q) => {
  if (!/(status distribution|task status|status breakdown)/.test(q)) return null;
  const data = buildStatusPieData(tasks);
  const text = "Current task status distribution:\n" + data.map((d) => `• ${d.name}: ${d.value}`).join("\n");
  return { text, chart: { kind: "pie", title: "Task Status Distribution", data } };
};

const matchProgressSummary: Matcher = (q) => {
  if (!/(progress summary|overall progress|status summary|how.*(is|are).*progress)/.test(q)) return null;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const text = `Portfolio is **${pct}% complete** (${completed}/${total} tasks). Per project:\n` + projects.map((p) => `• ${p.name}: ${p.progress}%`).join("\n");
  const chart: ChartSpec = {
    kind: "bar",
    title: "Progress by Project",
    data: projects.map((p) => ({ name: p.name.split(" ")[0], _fullLabel: p.name, progress: p.progress })),
    bars: [{ key: "progress", name: "Progress %", color: "hsl(224, 76%, 48%)", drillTemplate: "Tell me more about {label}" }],
  };
  return { text, chart };
};

// Fires for questions naming a project (e.g. "Skyline", "how's Marine
// Heights doing"). Previously returned a single status pie chart; now
// returns the pie PLUS a progress-by-tower bar AND a completed/in-progress/
// delayed-by-department stacked bar, so asking about "Skyline" gives you
// the pie chart, the progress bar, and the completion breakdown together.
const matchProjectSummary: Matcher = (q) => {
  const project = findProject(q);
  if (!project) return null;
  const pTasks = tasks.filter((t) => t.projectId === project.id);
  const delayed = pTasks.filter((t) => t.delayDays > 0);
  const text = `**${project.name}** (${project.location}) — **${project.progress}%** complete, status: ${project.status}. ${pTasks.length} task(s), ${delayed.length} delayed (${delayed.reduce((a, t) => a + t.delayDays, 0)} delay days). RERA: ${project.reraNumber}.`;

  const statusPie: ChartSpec = {
    kind: "pie",
    title: `${project.name} — Task Status`,
    data: buildStatusPieData(pTasks, project.name),
  };

  const projectTowers = towers.filter((t) => t.projectId === project.id);
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
        title: `${project.name} — Completed / In Progress / Delayed by Department`,
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

const matchDepartmentSummary: Matcher = (q) => {
  const dept = findDepartment(q);
  if (!dept) return null;
  const dTasks = tasks.filter((t) => t.department === dept);
  const completed = dTasks.filter((t) => t.status === "completed").length;
  const delayed = dTasks.filter((t) => t.status === "delayed" || t.status === "blocked").length;
  const text = `**${dept}** has ${dTasks.length} task(s): ${completed} completed, ${delayed} delayed/blocked, ${dTasks.reduce((a, t) => a + t.delayDays, 0)} total delay days.`;
  return { text, chart: { kind: "pie", title: `${dept} — Task Status`, data: buildStatusPieData(dTasks, dept) } };
};

const matchTowerSummary: Matcher = (q) => {
  const tower = findTower(q);
  if (!tower) return null;
  const tTasks = tasks.filter((t) => t.towerId === tower.id);
  const text = `**${tower.name}** is at **${tower.progress}%** progress (${tower.status}), ${tTasks.length} task(s) across ${tower.totalFloors} floors.`;
  return { text, chart: { kind: "pie", title: `${tower.name} — Task Status`, data: buildStatusPieData(tTasks, tower.name) } };
};

// Order matters: the specific drill-down matchers run first so a tapped
// chart always resolves to the deeper answer instead of a broader one.
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

function resolveLocalAnswer(rawQuery: string): LocalAnswer | null {
  const q = rawQuery.toLowerCase().trim();
  for (const matcher of matchers) {
    const result = matcher(q);
    if (result) {
      if (CHART_WORDS.test(q) && !result.chart && !result.charts?.length) {
        return { ...result, chart: { kind: "pie", title: "Task Status Distribution", data: buildStatusPieData(tasks) } };
      }
      return result;
    }
  }
  if (CHART_WORDS.test(q)) {
    return {
      text: "I couldn't match that to a specific report, so here's a general snapshot of your current task status:",
      chart: { kind: "pie", title: "Task Status Distribution", data: buildStatusPieData(tasks) },
    };
  }
  return null;
}

function buildGroundingContext(): string {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const delayed = tasks.filter((t) => t.delayDays > 0).length;
  const openHurdles = hurdles.filter((h) => h.status !== "resolved").length;
  return [
    "You are answering strictly from the following real project data. Do not invent numbers, names, or facts not listed here. If the answer isn't derivable from this data, say so explicitly.",
    `Projects: ${projects.map((p) => `${p.name} (${p.progress}% complete, ${p.status})`).join("; ")}`,
    `Towers: ${towers.map((t) => t.name).join(", ")}`,
    `Departments: ${Array.from(new Set(tasks.map((t) => t.department))).join(", ")}`,
    `Totals: ${total} tasks, ${completed} completed, ${delayed} delayed, ${openHurdles} open hurdles.`,
  ].join("\n");
}

/* =========================================================================
 * 4. MAIN COMPONENT – with per‑user persistence, clear button, NO badge
 * ===================================================================== */

const suggestions = [
  "Which project is most delayed?",
  "Show overdue tasks",
  "Show hurdles affecting a tower",
  "Predict next delay risk",
  "Give me a progress summary",
  "Show risk by department as a chart",
  "Department performance chart",
  "Task status distribution pie chart",
  "Tell me about Skyline",
];

// Always-visible quick-topic nav — distinct from `suggestions` above, which
// only shows for the first couple of messages. Each entry maps straight to
// an existing matcher's trigger phrase, so tapping one behaves exactly like
// typing that question and hitting send.
const navTopics: { label: string; icon: LucideIcon; query: string }[] = [
  { label: "Projects", icon: Building2, query: "Give me a progress summary" },
  { label: "Risk", icon: AlertTriangle, query: "Predict next delay risk" },
  { label: "Delays", icon: Clock, query: "Show overdue tasks" },
  { label: "Hurdles", icon: Construction, query: "Show hurdles affecting a tower" },
  { label: "Departments", icon: Users, query: "Department performance chart" },
  { label: "Risk by Dept", icon: Activity, query: "Show risk by department as a chart" },
  { label: "Status", icon: PieChartIcon, query: "Task status distribution pie chart" },
];

// One level of the drill-down panel's navigation stack. `label` is what
// shows in the breadcrumb; `answer` is the resolved text + optional chart(s)
// for that level, so re-opening the panel doesn't need to recompute anything.
type DrillStep = { query: string; label: string; answer: LocalAnswer };

const AIAssistant = () => {
  const { user } = useAuth();

  const getStorageKey = () => {
    if (!user) return "ai_chat_messages_guest";
    return `ai_chat_messages_${user.id}`;
  };

  const getDrillStorageKey = () => {
    if (!user) return "ai_drill_stack_guest";
    return `ai_drill_stack_${user.id}`;
  };

  const loadDrillStack = (): DrillStep[] => {
    try {
      const stored = localStorage.getItem(getDrillStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {
      // ignore
    }
    return [];
  };

  const INITIAL_MESSAGE: ChatMessage = {
    role: "assistant",
    text: "Hello! I'm your **Real Estate Execution OS** assistant. I answer directly from your live project data — delays, hurdles, risk, and performance — and I can show any of it as a chart if you ask. Ask about a project (like \"Skyline\") to get its status pie, progress-by-tower bar, and department breakdown all at once. Tap any bar or slice in a chart to drill into the details. What would you like to know?",
    grounded: true,
  };

  const loadMessages = (): ChatMessage[] => {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (_) {
        // ignore
      }
    }
    return [INITIAL_MESSAGE];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [drillStack, setDrillStack] = useState<DrillStep[]>(loadDrillStack());
  const [drillOpen, setDrillOpen] = useState(false);

  useEffect(() => {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(messages));
  }, [messages, user]);

  useEffect(() => {
    setMessages(loadMessages());
  }, [user]);

  useEffect(() => {
    localStorage.setItem(getDrillStorageKey(), JSON.stringify(drillStack));
  }, [drillStack, user]);

  useEffect(() => {
    setDrillStack(loadDrillStack());
    setDrillOpen(false);
  }, [user]);

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  // Tapping a bar/slice never touches the chat — it resolves the follow-up
  // question and pushes it onto the drill-down panel's stack instead, going
  // one level deeper each time (whether the tap came from the chat or from
  // inside the panel itself).
  const openDrill = (query: string) => {
    const answer = resolveLocalAnswer(query);
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

    const local = resolveLocalAnswer(msg);
    if (local) {
      setMessages((prev) => [...prev, { role: "assistant", text: local.text, chart: local.chart, charts: local.charts, grounded: true }]);
      return;
    }

    setSending(true);
    try {
      const context = buildGroundingContext();
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

  const currentDrill = drillStack[drillStack.length - 1];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">AI Assistant</h1>
          <p className="text-muted-foreground mt-1">Answers grounded in your project data — ask for a chart, then tap it to drill in</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Always-visible quick-topic nav — separate from the first-message-only
          suggestion chips below. These stay put for the life of the page so
          a common report is always one tap away, no matter how long the
          conversation has gotten. */}
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
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
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
                <button key={i} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors">
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

      {/* Drill-down panel — lives outside the chat entirely. Tapping a chart
          bar/slice never posts into the conversation; it opens or pushes
          onto this panel instead, and the whole stack is saved per-user so
          it's still there next time you open the assistant. */}
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
              <AnswerBody text={currentDrill.answer.text} chart={currentDrill.answer.chart} charts={currentDrill.answer.charts} onDrillQuery={openDrill} />
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