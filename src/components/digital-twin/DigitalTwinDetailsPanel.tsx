import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type {
  DigitalTwinSelection,
  ProjectRollup,
  TowerRollup,
  FloorRollup,
  UnitRollup,
} from "./types";
import type { ApiTask, ApiChecklist, ApiSubTask, User } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Layers,
  Grid3X3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Search,
  ListTodo,
  Boxes,
  User as UserIcon,
  Calendar,
  X,
  ChevronRight,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  Link2,
} from "lucide-react";
import { ScheduleMappingModal } from "./ScheduleMappingModal";

interface DigitalTwinDetailsPanelProps {
  projectRollup: ProjectRollup;
  selection: DigitalTwinSelection;
  onSelect: (sel: DigitalTwinSelection) => void;
  onClose: () => void;
  onUpdateTaskProgress: (taskId: number, newProgress: number) => void;
  onToggleChecklistItem?: (taskId: number, itemId: number) => void;
  users: User[];
}

export const DigitalTwinDetailsPanel: React.FC<DigitalTwinDetailsPanelProps> = ({
  projectRollup,
  selection,
  onSelect,
  onClose,
  onUpdateTaskProgress,
  onToggleChecklistItem,
  users,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editProgressVal, setEditProgressVal] = useState<number>(0);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleFilterOnlyMilestones, setScheduleFilterOnlyMilestones] = useState(false);

  // Find active entity objects
  const activeTower = useMemo(
    () => projectRollup.towers.find((t) => t.tower.id === selection.towerId) || null,
    [projectRollup, selection.towerId]
  );

  const activeFloor = useMemo(() => {
    if (!activeTower || !selection.floorId) return null;
    return activeTower.floors.find((f) => f.floor.id === selection.floorId) || null;
  }, [activeTower, selection.floorId]);

  const activeUnit = useMemo(() => {
    if (!activeFloor || !selection.unitId) return null;
    return activeFloor.units.find((u) => u.unit.id === selection.unitId) || null;
  }, [activeFloor, selection.unitId]);

  // Determine current scope data
  const currentScopeData = useMemo(() => {
    if (activeUnit) {
      return {
        title: `Unit ${activeUnit.unit.unitNumber || activeUnit.unit.id}`,
        subtitle: `${activeFloor?.floor.name} • ${activeTower?.tower.name}`,
        type: "unit" as const,
        progress: activeUnit.progress,
        status: activeUnit.status,
        tasks: activeUnit.tasks,
        checklists: activeUnit.checklists,
        subtasks: activeUnit.subtasks,
        totalTasks: activeUnit.totalTasks,
        completedTasks: activeUnit.completedTasks,
        overdueTasks: activeUnit.overdueTasks,
        meta: {
          type: activeUnit.unit.type || "Standard",
          area: activeUnit.unit.areaSqFt ? `${activeUnit.unit.areaSqFt} sq.ft` : null,
          unitStatus: activeUnit.unit.status || "available",
        },
      };
    }

    if (activeFloor) {
      const isMumty = activeFloor.floorType === "mumty";
      const isTerrace = activeFloor.floorType === "terrace";
      const floorSubtitle = isMumty
        ? `Rooftop Stairhead / LMR • ${activeTower?.tower.name || "Tower"}`
        : isTerrace
        ? `Open Rooftop Terrace • ${activeTower?.tower.name || "Tower"}`
        : activeTower?.tower.name || "Tower Floor";

      return {
        title: activeFloor.floor.name,
        subtitle: floorSubtitle,
        type: "floor" as const,
        progress: activeFloor.progress,
        status: activeFloor.status,
        tasks: activeFloor.allTasks,
        checklists: projectRollup.allChecklists.filter((c) => c.floorId === activeFloor.floor.id),
        subtasks: projectRollup.allSubTasks.filter((s) => s.floorId === activeFloor.floor.id),
        totalTasks: activeFloor.totalTasks,
        completedTasks: activeFloor.completedTasks,
        overdueTasks: activeFloor.overdueTasks,
        meta: {
          number: isMumty
            ? "Rooftop Level (Mumty & LMR)"
            : isTerrace
            ? "Rooftop Terrace Level"
            : `Floor ${activeFloor.number}`,
          totalUnits: isMumty
            ? "Stairhead & Machinery Core"
            : isTerrace
            ? "Open Rooftop Deck & Parapet"
            : `${activeFloor.units.length} Units`,
        },
      };
    }

    if (activeTower) {
      return {
        title: activeTower.tower.name,
        subtitle: projectRollup.project.name,
        type: "tower" as const,
        progress: activeTower.progress,
        status: activeTower.status,
        tasks: activeTower.allTasks,
        checklists: projectRollup.allChecklists.filter((c) => c.towerId === activeTower.tower.id),
        subtasks: projectRollup.allSubTasks.filter((s) => s.towerId === activeTower.tower.id),
        totalTasks: activeTower.totalTasks,
        completedTasks: activeTower.completedTasks,
        overdueTasks: activeTower.overdueTasks,
        meta: {
          floors: `${activeTower.floors.length} Floors`,
          status: activeTower.tower.status,
        },
      };
    }

    // Default to Project level
    return {
      title: projectRollup.project.name,
      subtitle: projectRollup.project.location || "Project Root",
      type: "project" as const,
      progress: projectRollup.progress,
      status: projectRollup.status,
      tasks: projectRollup.allTasks,
      checklists: projectRollup.allChecklists,
      subtasks: projectRollup.allSubTasks,
      totalTasks: projectRollup.totalTasks,
      completedTasks: projectRollup.completedTasks,
      overdueTasks: projectRollup.overdueTasks,
      meta: {
        towers: `${projectRollup.towers.length} Towers`,
        floors: `${projectRollup.allFloors.length} Floors`,
        units: `${projectRollup.allUnits.length} Units`,
      },
    };
  }, [activeUnit, activeFloor, activeTower, projectRollup]);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return currentScopeData.tasks;
    const q = searchTerm.toLowerCase();
    return currentScopeData.tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
    );
  }, [currentScopeData.tasks, searchTerm]);

  // Helper to find assigned user name
  const getUserName = (userId: number | null | undefined) => {
    if (!userId) return "Unassigned";
    const u = users.find((user) => user.id === userId);
    return u?.name || u?.username || `User #${userId}`;
  };

  const toggleTaskExpanded = (taskId: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <Card className="h-full flex flex-col border border-border shadow-lg bg-card/95 backdrop-blur-md overflow-hidden">
      {/* Header & Navigation Breadcrumbs */}
      <CardHeader className="p-4 border-b border-border space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <button
              onClick={() =>
                onSelect({
                  scope: "project",
                  projectId: projectRollup.project.id,
                  towerId: null,
                  floorId: null,
                  unitId: null,
                })
              }
              className="hover:text-foreground font-medium transition-colors truncate"
            >
              {projectRollup.project.name}
            </button>
            {activeTower && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <button
                  onClick={() =>
                    onSelect({
                      scope: "tower",
                      projectId: projectRollup.project.id,
                      towerId: activeTower.tower.id,
                      floorId: null,
                      unitId: null,
                    })
                  }
                  className="hover:text-foreground font-medium transition-colors truncate"
                >
                  {activeTower.tower.name}
                </button>
              </>
            )}
            {activeFloor && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <button
                  onClick={() =>
                    onSelect({
                      scope: "floor",
                      projectId: projectRollup.project.id,
                      towerId: activeTower?.tower.id ?? null,
                      floorId: activeFloor.floor.id,
                      unitId: null,
                    })
                  }
                  className="hover:text-foreground font-medium transition-colors truncate"
                >
                  {activeFloor.floor.name}
                </button>
              </>
            )}
            {activeUnit && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-semibold truncate">
                  Unit {activeUnit.unit.unitNumber || activeUnit.unit.id}
                </span>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Title & Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold truncate text-foreground">
                {currentScopeData.title}
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-mono px-2 py-0.5 ${
                  currentScopeData.status === "completed"
                    ? "border-emerald-500 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                    : currentScopeData.status === "in_progress"
                    ? "border-slate-300 text-slate-800 bg-white/90 shadow-2xs dark:border-white/40 dark:text-white dark:bg-white/10"
                    : currentScopeData.status === "delayed"
                    ? "border-rose-500 text-rose-600 bg-rose-500/10 dark:text-rose-400"
                    : "border-slate-500 text-slate-500"
                }`}
              >
                {currentScopeData.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{currentScopeData.subtitle}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Scope Completion</span>
            <span className="font-semibold text-foreground">{currentScopeData.progress}%</span>
          </div>
          <Progress value={currentScopeData.progress} className="h-2" />
        </div>

        {/* Quick Scope Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
          <div className="p-2 rounded-lg bg-background/60 border border-border/40">
            <p className="text-xs text-muted-foreground">Tasks</p>
            <p className="text-base font-bold text-foreground">
              {currentScopeData.completedTasks}/{currentScopeData.totalTasks}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-background/60 border border-border/40">
            <p className="text-xs text-muted-foreground">Checklists</p>
            <p className="text-base font-bold text-foreground">
              {currentScopeData.checklists.length}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-background/60 border border-border/40">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={`text-base font-bold ${currentScopeData.overdueTasks > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {currentScopeData.overdueTasks}
            </p>
          </div>
        </div>

        {/* Quick Action Bar for Schedule & 3D Mapping */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMappingModalOpen(true)}
            className="flex-1 h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Map Schedule to 3D</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/timeline`)}
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <span>Timeline</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {/* Tabs for Work Items */}
      <Tabs defaultValue="tasks" className="flex-1 flex flex-col min-h-0">
        <div className="px-2.5 py-2 border-b border-border/70 bg-muted/15">
          <TabsList className="grid grid-cols-4 w-full h-8.5 p-1 bg-muted/70 rounded-lg gap-1.5">
            <TabsTrigger
              value="tasks"
              className="h-7 px-1 text-[11px] font-medium gap-1 rounded-md flex items-center justify-center min-w-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <span className="truncate">Tasks</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-muted-foreground/15 text-muted-foreground font-semibold leading-none shrink-0">
                {currentScopeData.tasks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="h-7 px-1 text-[11px] font-medium gap-1 rounded-md flex items-center justify-center min-w-0 text-purple-600 dark:text-purple-400 data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all"
            >
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="truncate">Schedule</span>
            </TabsTrigger>
            <TabsTrigger
              value="checklists"
              className="h-7 px-1 text-[11px] font-medium gap-1 rounded-md flex items-center justify-center min-w-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <span className="truncate">Checklists</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-muted-foreground/15 text-muted-foreground font-semibold leading-none shrink-0">
                {currentScopeData.checklists.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="subtasks"
              className="h-7 px-1 text-[11px] font-medium gap-1 rounded-md flex items-center justify-center min-w-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <span className="truncate">Subtasks</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-muted-foreground/15 text-muted-foreground font-semibold leading-none shrink-0">
                {currentScopeData.subtasks.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. TASKS TAB */}
        <TabsContent value="tasks" className="flex-1 flex flex-col p-4 space-y-3 min-h-0 overflow-hidden m-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs pl-8 bg-background/80"
            />
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p>No tasks mapped to this location.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isOverdue =
                  task.status !== "completed" &&
                  (task.status === "delayed" ||
                    task.status === "blocked" ||
                    Boolean(task.delayDays && task.delayDays > 0) ||
                    (task.endDate && new Date(task.endDate) < new Date()));
                const isEditing = editingTaskId === task.id;
                const isExpanded = expandedTaskIds.has(task.id);

                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            #{task.id}
                          </span>
                          <span className="font-semibold text-xs text-foreground truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {task.department && <span>{task.department}</span>}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            <span>{getUserName(task.assignedTo)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 capitalize ${
                            task.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                              : task.status === "in_progress"
                              ? "bg-white text-slate-800 border-slate-300 dark:bg-white/15 dark:text-white dark:border-white/30"
                              : task.status === "delayed" || task.status === "blocked"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] px-1">
                            Delayed
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress Slider / View */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Completion</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {isEditing ? editProgressVal : task.progress}%
                          </span>
                          {!isEditing ? (
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditProgressVal(task.progress);
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                              title="Edit task progress"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onUpdateTaskProgress(task.id, editProgressVal);
                                  setEditingTaskId(null);
                                }}
                                className="text-emerald-500 hover:text-emerald-600 p-0.5"
                                title="Save progress"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setEditingTaskId(null)}
                                className="text-muted-foreground hover:text-foreground p-0.5"
                                title="Cancel"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={editProgressVal}
                          onChange={(e) => setEditProgressVal(Number(e.target.value))}
                          className="w-full h-1.5 accent-primary cursor-pointer"
                        />
                      ) : (
                        <Progress value={task.progress} className="h-1.5" />
                      )}
                    </div>

                    {/* Due Date & Expand Actions */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Due: {task.endDate || "No deadline"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {((task.checklist && task.checklist.length > 0) ||
                          (task.subtasks && task.subtasks.length > 0)) && (
                          <button
                            onClick={() => toggleTaskExpanded(task.id)}
                            className="text-primary hover:underline flex items-center gap-0.5"
                          >
                            <span>
                              {isExpanded ? "Hide details" : "Checklist & Subs"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate("/tasks", { state: { taskId: task.id } })}
                          className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                          title="Open in full Tasks view"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Task Checklist Items & Subtasks */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-border/60 space-y-2 bg-muted/20 p-2 rounded-lg">
                        {task.checklist && task.checklist.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                              Checklist Items
                            </span>
                            <div className="space-y-1">
                              {task.checklist.map((item) => (
                                <label
                                  key={item.id}
                                  className="flex items-center gap-2 text-xs cursor-pointer select-none text-foreground"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() =>
                                      onToggleChecklistItem?.(task.id, item.id)
                                    }
                                    className="accent-primary rounded h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span
                                    className={
                                      item.completed
                                        ? "line-through text-muted-foreground"
                                        : ""
                                    }
                                  >
                                    {item.title}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                              Subtasks ({task.subtasks.length})
                            </span>
                            <div className="space-y-1">
                              {task.subtasks.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between text-[11px] p-1.5 rounded bg-background border border-border/40"
                                >
                                  <span className="truncate">{sub.title}</span>
                                  <Badge variant="outline" className="text-[9px] px-1">
                                    {sub.status} ({sub.progress}%)
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* 2. CHECKLISTS TAB */}
        <TabsContent value="checklists" className="flex-1 p-4 space-y-2.5 overflow-y-auto min-h-0 m-0">
          {currentScopeData.checklists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
              <ListTodo className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>No checklists mapped to this location.</p>
            </div>
          ) : (
            currentScopeData.checklists.map((chk) => (
              <div
                key={chk.id}
                className="p-3 rounded-xl border border-border bg-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate text-foreground">{chk.name}</p>
                    <p className="text-[10px] text-muted-foreground">ID #{chk.id}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      chk.status === "completed"
                        ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                        : "border-amber-500 text-amber-500 bg-amber-500/10"
                    }`}
                  >
                    {chk.status || "Pending"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{chk.progress}%</span>
                  </div>
                  <Progress value={chk.progress} className="h-1.5" />
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/checklists")}
                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <span>View Checklists</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* 3. SUBTASKS TAB */}
        <TabsContent value="subtasks" className="flex-1 p-4 space-y-2.5 overflow-y-auto min-h-0 m-0">
          {currentScopeData.subtasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
              <Boxes className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>No subtasks mapped to this location.</p>
            </div>
          ) : (
            currentScopeData.subtasks.map((sub) => (
              <div
                key={sub.id}
                className="p-3 rounded-xl border border-border bg-card space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-xs truncate text-foreground">{sub.name}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      sub.status === "completed"
                        ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                        : "border-amber-500 text-amber-500 bg-amber-500/10"
                    }`}
                  >
                    {sub.status || "Pending"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{sub.progress}%</span>
                  </div>
                  <Progress value={sub.progress} className="h-1.5" />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* 4. SCHEDULE & WBS HIERARCHY TAB */}
        <TabsContent value="schedule" className="flex-1 flex flex-col p-4 space-y-3 min-h-0 overflow-hidden m-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search schedule WBS, tasks..."
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                className="h-8 text-xs pl-8 bg-background/80"
              />
            </div>
            <Button
              variant={scheduleFilterOnlyMilestones ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleFilterOnlyMilestones((v) => !v)}
              className="h-8 text-[11px] shrink-0 px-2"
            >
              Milestones
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {currentScopeData.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <FileCode className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p>No schedule tasks found for this scope.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMappingModalOpen(true)}
                  className="text-xs mt-1"
                >
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  Map Imported Schedule Tasks
                </Button>
              </div>
            ) : (
              currentScopeData.tasks
                .filter((t) => {
                  if (scheduleFilterOnlyMilestones && !t.isMilestone) return false;
                  if (scheduleSearch.trim()) {
                    const q = scheduleSearch.toLowerCase();
                    return (
                      t.title.toLowerCase().includes(q) ||
                      t.wbsCode?.toLowerCase().includes(q) ||
                      t.department?.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((task) => {
                  const isOverdue =
                    task.status !== "completed" &&
                    (task.status === "delayed" ||
                      task.status === "blocked" ||
                      Boolean(task.delayDays && task.delayDays > 0) ||
                      (task.endDate && new Date(task.endDate) < new Date()));

                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {task.wbsCode && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {task.wbsCode}
                              </span>
                            )}
                            <span className="font-semibold text-xs text-foreground truncate">
                              {task.title}
                            </span>
                            {task.isMilestone && (
                              <Badge className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                Milestone
                              </Badge>
                            )}
                            {task.criticalPath && (
                              <Badge className="text-[9px] px-1 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20">
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {task.department || "General"} • {task.durationDays || 1}d
                          </p>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${
                            task.status === "completed"
                              ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                              : isOverdue
                              ? "border-rose-500 text-rose-600 bg-rose-500/10"
                              : "border-border text-foreground"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Planned vs Actual Dates */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-muted/30 p-2 rounded-lg">
                        <div>
                          <span className="text-muted-foreground">Start: </span>
                          <span className="font-medium text-foreground">{task.startDate || "TBD"}</span>
                          {task.baselineStartDate && task.baselineStartDate !== task.startDate && (
                            <span className="text-muted-foreground/80 block text-[9px]">
                              Base: {task.baselineStartDate}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Finish: </span>
                          <span className="font-medium text-foreground">{task.endDate || "TBD"}</span>
                          {task.baselineEndDate && task.baselineEndDate !== task.endDate && (
                            <span className="text-muted-foreground/80 block text-[9px]">
                              Base: {task.baselineEndDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Predecessors / Dependencies */}
                      {task.predecessors && task.predecessors.length > 0 && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">Depends on:</span>
                          {task.predecessors.map((p, idx) => (
                            <span key={idx} className="bg-muted px-1.5 py-0.5 rounded font-mono">
                              Task #{p.predecessorId} ({p.type}{p.lagDays ? `+${p.lagDays}d` : ""})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-1.5" />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule Mapping Modal */}
      <ScheduleMappingModal
        projectId={projectRollup.project.id}
        open={isMappingModalOpen}
        onOpenChange={setIsMappingModalOpen}
        tasks={projectRollup.allTasks}
        towers={projectRollup.towers.map((t) => t.tower)}
        floors={projectRollup.allFloors}
        units={projectRollup.allUnits}
      />
    </Card>
  );
};
