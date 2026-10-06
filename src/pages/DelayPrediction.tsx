import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Shield,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Import API functions and types
import {
  tasksApi,
  hurdlesApi,
  projectsApi,
  towersApi,
  resolveImageUrl,
  type ApiTask,
  type ApiHurdle,
  type ApiProject,
  type ApiTower,
} from "@/lib/api";

/** Special value for the project <Select> meaning "don't filter". */
const ALL_PROJECTS = "all";

// ────────────────────────────────────────────────────────────────
// Helper functions (now accept data as arguments)
// ────────────────────────────────────────────────────────────────

function calculateRiskScore(
  task: ApiTask,
  allTasks: ApiTask[],
  allHurdles: ApiHurdle[]
): number {
  let score = 0;

  // Base: historical delay pattern
  if (task.delayDays > 0) score += Math.min(task.delayDays * 3, 30);

  // Dependency chain risk
  const deps = allTasks.filter((t) => task.dependencies.includes(t.id));
  const delayedDeps = deps.filter(
    (d) => d.status === "delayed" || d.status === "blocked"
  );
  score += delayedDeps.length * 15;

  // Active hurdles on same tower
  const towerHurdles = allHurdles.filter((h) => {
    const affectedTask = allTasks.find((t) => t.id === h.affectedTaskId);
    return affectedTask?.towerId === task.towerId && h.status !== "resolved";
  });
  score += towerHurdles.length * 10;
  score += towerHurdles.filter((h) => h.severity === "critical").length * 10;

  // Progress vs timeline risk
  if (task.startDate && task.endDate) {
    const start = new Date(task.startDate).getTime();
    const end = new Date(task.endDate).getTime();
    const now = Date.now();
    const totalDuration = end - start;
    const elapsed = now - start;
    const expectedProgress = Math.min(
      100,
      Math.max(0, (elapsed / totalDuration) * 100)
    );
    const progressGap = expectedProgress - task.progress;
    if (progressGap > 20) score += 20;
    else if (progressGap > 10) score += 10;
  }

  // Critical path multiplier
  if (task.criticalPath) score = Math.round(score * 1.3);

  // Status penalties
  if (task.status === "blocked") score += 25;
  if (task.status === "delayed") score += 20;

  return Math.min(100, Math.max(0, score));
}

function getRiskLevel(score: number): {
  label: string;
  color: string;
  badgeClass: string;
} {
  if (score >= 60)
    return {
      label: "High Risk",
      color: "text-destructive",
      badgeClass: "bg-destructive text-destructive-foreground",
    };
  if (score >= 30)
    return {
      label: "Medium Risk",
      color: "text-warning",
      badgeClass: "bg-warning text-warning-foreground",
    };
  return {
    label: "Low Risk",
    color: "text-success",
    badgeClass: "bg-success text-success-foreground",
  };
}

function getPredictions(
  tasks: ApiTask[],
  hurdles: ApiHurdle[],
  projects: ApiProject[],
  towers: ApiTower[],
  projectId?: string
) {
  const activeTasks = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      (!projectId || projectId === ALL_PROJECTS || String(t.projectId) === projectId)
  );

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const towerMap = Object.fromEntries(towers.map((t) => [t.id, t]));

  return activeTasks
    .map((task) => {
      const riskScore = calculateRiskScore(task, tasks, hurdles);
      const risk = getRiskLevel(riskScore);
      return {
        task,
        riskScore,
        risk,
        project: projectMap[task.projectId] || null,
        tower: task.towerId ? towerMap[task.towerId] || null : null,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

function computeRiskTrend(
  predictions: ReturnType<typeof getPredictions>
) {
  const weeksAgoList = [7, 6, 5, 4, 3, 2, 1, 0];
  const now = new Date();

  return weeksAgoList.map((weeksAgo, idx) => {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - weeksAgo * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const activeInWeek = predictions.filter(({ task }) => {
      if (!task.startDate || !task.endDate) return false;
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      return start <= weekEnd && end >= weekStart;
    });

    const risk = activeInWeek.length
      ? Math.round(
          activeInWeek.reduce((sum, p) => sum + p.riskScore, 0) /
            activeInWeek.length
        )
      : 0;

    return { week: `W${idx + 1}`, risk };
  });
}

// ────────────────────────────────────────────────────────────────
// Tooltip component (shared)
// ────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-medium">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? entry.fill ?? entry.payload?.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

type RiskLevelKey = "high" | "medium" | "low";

const RISK_LEVEL_META: Record<
  RiskLevelKey,
  {
    label: string;
    color: string;
    badgeClass: string;
    explain: (count: number, dept: string) => string;
  }
> = {
  high: {
    label: "High Risk",
    color: "hsl(0, 72%, 51%)",
    badgeClass: "bg-destructive text-destructive-foreground",
    explain: (count, dept) =>
      `${count} task${count === 1 ? "" : "s"} in ${dept} ${
        count === 1 ? "is" : "are"
      } scoring 60 or above. These tasks are stacking up multiple red flags at once — things like a history of delays, dependencies that are themselves blocked or delayed, active hurdles reported on the same tower, and progress that's falling behind the expected pace for this point in the timeline. Tasks on the critical path get an extra 1.3x weighting here, because a slip on one of these pushes out the whole project schedule, not just this task.`,
  },
  medium: {
    label: "Medium Risk",
    color: "hsl(38, 92%, 50%)",
    badgeClass: "bg-warning text-warning-foreground",
    explain: (count, dept) =>
      `${count} task${count === 1 ? "" : "s"} in ${dept} ${
        count === 1 ? "is" : "are"
      } scoring between 30 and 59. Usually that means one or two things are off — a modest historical delay, a single blocked dependency, or a noticeable but not severe gap between actual and expected progress — without enough compounding factors to tip it into High Risk yet. Worth keeping an eye on before it slides further.`,
  },
  low: {
    label: "Low Risk",
    color: "hsl(152, 60%, 42%)",
    badgeClass: "bg-success text-success-foreground",
    explain: (count, dept) =>
      `${count} task${count === 1 ? "" : "s"} in ${dept} ${
        count === 1 ? "is" : "are"
      } scoring under 30. Progress is roughly tracking the planned timeline, dependencies are clear, and there are no active hurdles on the same tower dragging the score up. This is the healthy zone.`,
  },
};

// ────────────────────────────────────────────────────────────────
// Risk by Department chart (with click‑through)
// ────────────────────────────────────────────────────────────────

function RiskByDepartmentChart({
  data,
  onSegmentClick,
}: {
  data: any[];
  onSegmentClick: (dept: string, level: RiskLevelKey) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<RiskLevelKey | null>(null);
  const onOver = (key: RiskLevelKey) => setHoveredKey(key);
  const onOut = () => setHoveredKey(null);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
        <Tooltip
          cursor={false}
          content={({ active, payload, label }) => {
            if (!active || !payload || !payload.length) return null;
            const filtered = hoveredKey
              ? payload.filter((p: any) => p.dataKey === hoveredKey)
              : payload;
            if (filtered.length === 0) return null;
            return (
              <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                <p className="text-xs font-medium">{label}</p>
                {filtered.map((entry: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color ?? entry.fill }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="font-medium">{entry.value}</span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border">
                  Click for details →
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="high"
          stackId="a"
          fill="hsl(0, 72%, 51%)"
          name="High"
          cursor="pointer"
          onMouseOver={() => onOver("high")}
          onMouseOut={onOut}
          onClick={(data: any) => onSegmentClick(data.name, "high")}
        />
        <Bar
          dataKey="medium"
          stackId="a"
          fill="hsl(38, 92%, 50%)"
          name="Medium"
          cursor="pointer"
          onMouseOver={() => onOver("medium")}
          onMouseOut={onOut}
          onClick={(data: any) => onSegmentClick(data.name, "medium")}
        />
        <Bar
          dataKey="low"
          stackId="a"
          fill="hsl(152, 60%, 42%)"
          radius={[0, 4, 4, 0]}
          name="Low"
          cursor="pointer"
          onMouseOver={() => onOver("low")}
          onMouseOut={onOut}
          onClick={(data: any) => onSegmentClick(data.name, "low")}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ────────────────────────────────────────────────────────────────
// Drill‑down component (receives data as props)
// ────────────────────────────────────────────────────────────────

function DepartmentRiskDrillDown({
  department,
  level,
  projectId,
  tasks,
  hurdles,
  projects,
  towers,
  onBack,
}: {
  department: string;
  level: RiskLevelKey;
  projectId: string;
  tasks: ApiTask[];
  hurdles: ApiHurdle[];
  projects: ApiProject[];
  towers: ApiTower[];
  onBack: () => void;
}) {
  const deptPredictions = getPredictions(tasks, hurdles, projects, towers, projectId).filter(
    (p) => p.task.department === department
  );
  const levelTasks = deptPredictions.filter((p) =>
    level === "high"
      ? p.riskScore >= 60
      : level === "medium"
      ? p.riskScore >= 30 && p.riskScore < 60
      : p.riskScore < 30
  );
  const meta = RISK_LEVEL_META[level];
  const avgScore = levelTasks.length
    ? Math.round(levelTasks.reduce((a, p) => a + p.riskScore, 0) / levelTasks.length)
    : 0;
  const totalDelayDays = levelTasks.reduce((a, p) => a + p.task.delayDays, 0);

  const taskScoreData = levelTasks.map((p) => ({
    name: p.task.title.length > 16 ? `${p.task.title.slice(0, 16)}…` : p.task.title,
    score: p.riskScore,
  }));

  const scopedProject = projectId === ALL_PROJECTS ? null : projects.find((p) => String(p.id) === projectId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Delay Prediction</span>
            <ChevronRight className="h-3 w-3" />
            {scopedProject && (
              <>
                <span>{scopedProject.name}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-foreground font-medium">
              {department} · {meta.label}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold mt-1">
            {department} — {meta.label}
          </h1>
          {scopedProject && (
            <p className="text-sm text-muted-foreground mt-0.5">Scoped to {scopedProject.name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="text-2xl font-display font-bold" style={{ color: meta.color }}>
              {levelTasks.length}
            </p>
            <p className="text-xs text-muted-foreground">Tasks at this level</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="text-2xl font-display font-bold">{avgScore}</p>
            <p className="text-xs text-muted-foreground">Average Risk Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="text-2xl font-display font-bold">{totalDelayDays}</p>
            <p className="text-xs text-muted-foreground">Total Delay Days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="text-2xl font-display font-bold">{deptPredictions.length}</p>
            <p className="text-xs text-muted-foreground">Active Tasks in {department}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display">What This Means</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {meta.explain(levelTasks.length, department)}
          </p>
        </CardContent>
      </Card>

      {taskScoreData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display">Risk Score by Task</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={taskScoreData} margin={{ left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Bar
                  dataKey="score"
                  fill={meta.color}
                  radius={[4, 4, 0, 0]}
                  name="Risk Score"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {levelTasks.map(({ task, riskScore, risk, project, tower }) => (
            <div key={task.id} className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex flex-col items-center gap-1">
                <div className="text-xl font-display font-bold" style={{ color: meta.color }}>
                  {riskScore}
                </div>
                <Badge className={`text-[9px] ${risk.badgeClass}`}>{risk.label}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{task.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project?.name} · {tower?.name}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <Progress value={task.progress} className="h-1.5 flex-1 max-w-[120px]" />
                  <span className="text-xs text-muted-foreground">{task.progress}%</span>
                  {task.delayDays > 0 && (
                    <Badge variant="destructive" className="text-[9px]">
                      +{task.delayDays}d delay
                    </Badge>
                  )}
                  {task.criticalPath && (
                    <Badge variant="outline" className="text-[9px]">
                      Critical Path
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
          {levelTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks at this risk level right now.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

const DelayPrediction = () => {
  const [drillDept, setDrillDept] = useState<{ name: string; level: RiskLevelKey } | null>(
    null
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(ALL_PROJECTS);

  // ── Data state ──
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [hurdles, setHurdles] = useState<ApiHurdle[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [towers, setTowers] = useState<ApiTower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Fetch all data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, hurdlesData, projectsData, towersData] = await Promise.all([
          tasksApi.list(),
          hurdlesApi.list(),
          projectsApi.list(),
          towersApi.list(),
        ]);
        setTasks(tasksData);
        setHurdles(hurdlesData);
        setProjects(projectsData);
        setTowers(towersData);
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

  // ── Memoized lookups ──
  const getProjectById = useMemo(
    () => (id: number) => validProjects.find((p) => p.id === id) || null,
    [validProjects]
  );
  const getTowerById = useMemo(
    () => (id: number) => validTowers.find((t) => t.id === id) || null,
    [validTowers]
  );

  // ── Predictions (re‑computed whenever any data or filter changes) ──
  const predictions = useMemo(() => {
    if (loading) return [];
    return getPredictions(validTasks, validHurdles, validProjects, validTowers, selectedProjectId);
  }, [validTasks, validHurdles, validProjects, validTowers, selectedProjectId, loading]);

  // ── Derived aggregates ──
  const highRisk = predictions.filter((p) => p.riskScore >= 60);
  const mediumRisk = predictions.filter((p) => p.riskScore >= 30 && p.riskScore < 60);
  const lowRisk = predictions.filter((p) => p.riskScore < 30);
  const onTrack = predictions.filter((p) => p.riskScore < 30 && (p.task.delayDays || 0) === 0);
  const delayedTasks = predictions.filter((p) => (p.task.delayDays || 0) > 0 || p.task.status === "delayed");

  const avgPredictedDelayDays = predictions.length
    ? Math.round(
        predictions.reduce(
          (sum, p) => sum + (p.task.delayDays || 0) + (p.riskScore >= 60 ? 4 : p.riskScore >= 30 ? 1 : 0),
          0
        ) / predictions.length
      )
    : 0;

  const selectedProject =
    selectedProjectId === ALL_PROJECTS ? null : getProjectById(Number(selectedProjectId));

  const completionProgress = selectedProject
    ? selectedProject.progress
    : validProjects.length
    ? Math.round(validProjects.reduce((a, p) => a + (p.progress || 0), 0) / validProjects.length)
    : 0;

  const expectedCompletionDate = useMemo(() => {
    const dates = predictions
      .map((p) => p.task.endDate)
      .filter(Boolean) as string[];
    if (dates.length > 0) {
      dates.sort();
      return dates[dates.length - 1];
    }
    return selectedProject?.endDate || "On Schedule";
  }, [predictions, selectedProject]);

  const overallDelayRisk = highRisk.length > 0 ? "High Risk" : mediumRisk.length > 0 ? "Moderate Risk" : "Low Risk";
  const overallRiskBadge = highRisk.length > 0
    ? "bg-destructive text-destructive-foreground"
    : mediumRisk.length > 0
    ? "bg-warning text-warning-foreground"
    : "bg-success text-success-foreground";

  const riskByDept = Object.entries(
    predictions.reduce(
      (acc, p) => {
        const dept = p.task.department || "General";
        if (!acc[dept]) acc[dept] = { high: 0, medium: 0, low: 0 };
        if (p.riskScore >= 60) acc[dept].high++;
        else if (p.riskScore >= 30) acc[dept].medium++;
        else acc[dept].low++;
        return acc;
      },
      {} as Record<string, { high: number; medium: number; low: number }>
    )
  ).map(([name, data]) => ({ name, ...data }));

  const riskTrend = useMemo(() => computeRiskTrend(predictions), [predictions]);

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading prediction data…</p>
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

  // ── Empty State if no active projects ──
  if (validProjects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Delay Prediction Engine</h1>
          <p className="text-muted-foreground mt-1">Schedule risk and forecasting</p>
        </div>
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg">No Active Projects Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Delay predictions are based only on currently existing projects. Create a project and add tasks to generate forecasts.
          </p>
        </Card>
      </div>
    );
  }

  if (drillDept) {
    return (
      <DepartmentRiskDrillDown
        department={drillDept.name}
        level={drillDept.level}
        projectId={selectedProjectId}
        tasks={validTasks}
        hurdles={validHurdles}
        projects={validProjects}
        towers={validTowers}
        onBack={() => setDrillDept(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            Delay Prediction Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time construction delay forecasting
            {selectedProject ? ` for ${selectedProject.name}` : " across all active projects"}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All Projects</SelectItem>
              {validProjects.map((p) => (
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
      </div>

      {/* KPI Cards: On Track, At Risk, Delayed, Predicted Delay */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-success">{onTrack.length}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-warning">{mediumRisk.length + highRisk.length}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-destructive">{delayedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">
                  {avgPredictedDelayDays > 0 ? `+${avgPredictedDelayDays}d` : "0d"}
                </p>
                <p className="text-xs text-muted-foreground">Predicted Delay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Status Banner: Completion Progress, Expected Completion, Delay Risk */}
      <Card className="bg-card/50 border">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Completion Progress</span>
                <span className="font-bold">{completionProgress}%</span>
              </div>
              <Progress value={completionProgress} className="h-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expected Completion</p>
              <p className="text-lg font-display font-bold mt-1">{expectedCompletionDate}</p>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Delay Risk</p>
                <Badge className={`mt-1 ${overallRiskBadge}`}>{overallDelayRisk}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Risk Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display">Risk Trend (8 Weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            {riskTrend.some((r) => r.risk > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="hsl(0, 72%, 51%)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Risk Index"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-center text-xs text-muted-foreground">
                Not enough historical timeline data to generate an 8-week risk trend.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk by Department */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display">
              Risk by Department{" "}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                Click a segment →
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskByDept.length > 0 ? (
              <RiskByDepartmentChart
                data={riskByDept}
                onSegmentClick={(name, level) => setDrillDept({ name, level })}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-center text-xs text-muted-foreground">
                No department task data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Affected Tasks / Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Affected Tasks &amp; Schedule Risk
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {predictions.length} active task{predictions.length === 1 ? "" : "s"} evaluated
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {predictions.length === 0 && (
            <div className="text-center py-10">
              <AlertTriangle className="h-10 w-10 text-amber-500/70 mx-auto mb-2" />
              <p className="font-semibold text-foreground">
                Not enough data available to generate a reliable prediction.
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No active tasks with progress or timeline data found{selectedProject ? ` for ${selectedProject.name}` : ""}.
              </p>
            </div>
          )}
          {predictions.slice(0, 10).map(({ task, riskScore, risk, project, tower }) => (
            <Dialog key={task.id}>
              <DialogTrigger asChild>
                <div className="flex items-center gap-4 p-4 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`text-xl font-display font-bold ${risk.color}`}>
                      {riskScore}
                    </div>
                    <Badge className={`text-[9px] ${risk.badgeClass}`}>{risk.label}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project?.name} · {tower?.name} · {task.department}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Progress value={task.progress} className="h-1.5 flex-1 max-w-[120px]" />
                      <span className="text-xs text-muted-foreground">{task.progress}%</span>
                      {task.delayDays > 0 && (
                        <Badge variant="destructive" className="text-[9px]">
                          +{task.delayDays}d delay
                        </Badge>
                      )}
                      {task.criticalPath && (
                        <Badge variant="outline" className="text-[9px]">
                          Critical Path
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">Risk Analysis: {task.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-display font-bold ${risk.color}`}>
                      {riskScore}
                    </div>
                    <div>
                      <Badge className={risk.badgeClass}>{risk.label}</Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Composite Risk Score
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Risk Factors</h4>
                    <div className="space-y-1.5 text-sm">
                      {task.delayDays > 0 && (
                        <div className="flex items-center gap-2 text-destructive">
                          • Historical delay: {task.delayDays} days
                        </div>
                      )}
                      {task.status === "blocked" && (
                        <div className="flex items-center gap-2 text-destructive">
                          • Task is currently blocked
                        </div>
                      )}
                      {task.criticalPath && (
                        <div className="flex items-center gap-2 text-warning">
                          • On critical path (1.3x multiplier)
                        </div>
                      )}
                      {task.dependencies.length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          • {task.dependencies.length} dependencies
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        • Progress: {task.progress}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Project:</span>{" "}
                      <span className="font-medium">{project?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tower:</span>{" "}
                      <span className="font-medium">{tower?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phase:</span>{" "}
                      <span className="font-medium">{task.phase}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Planned End:</span>{" "}
                      <span className="font-medium">{task.endDate}</span>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default DelayPrediction;