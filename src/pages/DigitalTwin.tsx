import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { statusLabels } from "@/data/demo-data";
import { Building2, Layers, Grid3X3, ArrowLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  projectsApi,
  towersApi,
  floorsApi,
  tasksApi,
  ApiError,
  resolveImageUrl,
  type ApiProject,
  type ApiTower,
  type ApiFloor,
  type ApiTask,
} from "@/lib/api";

// ============================================================================
// Digital Twin — driven entirely by live API data instead of demo-data.
//
// Drill-down: Projects -> Towers -> Floors -> Units / Floor-level Tasks
//
// EDITING: only Project.progress and Task.progress are real, persisted
// fields with an update endpoint (projectsApi.update / tasksApi.update).
// Towers and Floors only have a `list()` in the API — no update endpoint —
// so their progress here is always a computed rollup from their tasks, not
// something you can PATCH directly. Editing a task's progress updates that
// rollup automatically everywhere it's shown (tower card, floor row, unit
// card) since they all derive from the same ["tasks"] query.
// ============================================================================

type View = "projects" | "towers" | "floors" | "units";

const getStatusDot = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-success";
    case "in_progress":
      return "bg-warning";
    case "delayed":
    case "blocked":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/30";
  }
};

const getBgColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-success/10 border-success/30";
    case "in_progress":
      return "bg-warning/10 border-warning/30";
    case "delayed":
    case "blocked":
      return "bg-destructive/10 border-destructive/30";
    default:
      return "bg-muted border-border";
  }
};

// Roll a set of tasks up into a single aggregate status.
function aggregateStatus(groupTasks: ApiTask[]): string {
  if (groupTasks.length === 0) return "not_started";
  const total = groupTasks.length;
  const completed = groupTasks.filter((t) => t.status === "completed").length;
  const hasDelay = groupTasks.some((t) => t.status === "delayed" || t.status === "blocked");
  const inProgress = groupTasks.some((t) => t.status === "in_progress");
  if (completed === total) return "completed";
  if (hasDelay) return "delayed";
  if (inProgress) return "in_progress";
  return "not_started";
}

// Real progress % for any group of tasks — the average of each task's own
// `progress` field, so a group with tasks at 40-60% in-progress shows that
// instead of a blunt completed/total ratio.
function computeAvgProgress(groupTasks: ApiTask[]): number {
  if (groupTasks.length === 0) return 0;
  const sum = groupTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
  return Math.round(sum / groupTasks.length);
}

// ============================================================================
// EditableProgress — click a real, persisted progress value to open a
// slider, then Save/Cancel. Used for Project.progress and Task.progress,
// the only two fields the API can actually update.
// ============================================================================

function EditableProgress({
  value,
  onSave,
  saving,
  barClassName = "h-2",
}: {
  value: number;
  onSave: (newValue: number) => void;
  saving?: boolean;
  barClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (!editing) setLocalValue(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLocalValue(value);
          setEditing(true);
        }}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <Progress value={value} className={`${barClassName} flex-1`} />
          <span className="text-xs font-medium w-10 text-right shrink-0">{value}%</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <input
        type="range"
        min={0}
        max={100}
        value={localValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        disabled={saving}
        className="flex-1 accent-primary h-1.5 cursor-pointer"
      />
      <span className="text-xs font-medium w-10 text-right shrink-0">{localValue}%</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0"
        disabled={saving}
        onClick={() => {
          onSave(localValue);
          setEditing(false);
        }}
      >
        <Check className="h-3.5 w-3.5 text-success" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0"
        disabled={saving}
        onClick={() => setEditing(false)}
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// Read-only rollup display for Tower/Floor/Unit — clearly labeled as
// computed, since there's no update endpoint for these to write to.
function ComputedProgress({ value, barClassName = "h-2" }: { value: number; barClassName?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className={`${barClassName} flex-1`} />
      <span className="text-xs font-medium w-10 text-right shrink-0">{value}%</span>
    </div>
  );
}

const DigitalTwin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErrorObj,
  } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  const { data: towers = [], isLoading: towersLoading } = useQuery({
    queryKey: ["towers"],
    queryFn: towersApi.list,
  });

  const { data: floors = [], isLoading: floorsLoading } = useQuery({
    queryKey: ["floors"],
    queryFn: floorsApi.list,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: tasksApi.list,
  });

  const isLoading = projectsLoading || towersLoading || floorsLoading || tasksLoading;

  // ----- Mutations: the only two fields the backend can actually persist -----

  const updateProjectProgress = useMutation({
    mutationFn: ({ id, progress }: { id: number; progress: number }) =>
      projectsApi.update(id, { progress }),
    onMutate: async ({ id, progress }) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueryData<ApiProject[]>(["projects"]);
      queryClient.setQueryData<ApiProject[]>(["projects"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, progress } : p))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["projects"], context.previous);
      toast({
        title: "Couldn't update project progress",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => toast({ title: "Project progress updated" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const updateTaskProgress = useMutation({
    mutationFn: ({ id, progress }: { id: number; progress: number }) =>
      tasksApi.update(id, { progress }),
    onMutate: async ({ id, progress }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<ApiTask[]>(["tasks"]);
      queryClient.setQueryData<ApiTask[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, progress } : t))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous);
      toast({
        title: "Couldn't update task progress",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => toast({ title: "Task progress updated" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const selectedProject = useMemo(
    () => projects.find((p: ApiProject) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedTower = useMemo(
    () => towers.find((t: ApiTower) => t.id === selectedTowerId) || null,
    [towers, selectedTowerId]
  );
  const selectedFloor = useMemo(
    () => floors.find((f: ApiFloor) => f.id === selectedFloorId) || null,
    [floors, selectedFloorId]
  );

  // Global task counts by status, shown as clickable summary blocks above
  // the twin — clicking one jumps to the Tasks page pre-filtered to that
  // status.
  const taskCounts = useMemo(() => {
    return {
      not_started: tasks.filter((t: ApiTask) => t.status === "not_started").length,
      in_progress: tasks.filter((t: ApiTask) => t.status === "in_progress").length,
      completed: tasks.filter((t: ApiTask) => t.status === "completed").length,
      delayed: tasks.filter((t: ApiTask) => t.status === "delayed").length,
    };
  }, [tasks]);

  const goToTasksFilteredBy = (status: string) => {
    navigate("/tasks", { state: { statusFilter: status } });
  };

  const goBack = () => {
    if (view === "units") {
      setView("floors");
      setSelectedFloorId(null);
    } else if (view === "floors") {
      setView("towers");
      setSelectedTowerId(null);
    } else if (view === "towers") {
      setView("projects");
      setSelectedProjectId(null);
    }
  };

  const breadcrumb = () => {
    const parts: string[] = ["Digital Twin"];
    if (selectedProject) parts.push(selectedProject.name);
    if (selectedTower) parts.push(selectedTower.name);
    if (selectedFloor) parts.push(selectedFloor.name);
    return parts;
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-16">Loading digital twin…</p>;
  }

  if (projectsError) {
    return (
      <p className="text-center text-destructive py-16">
        Couldn't load digital twin
        {projectsErrorObj instanceof ApiError ? `: ${projectsErrorObj.message}` : ""}. Is the
        backend running?
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {view !== "projects" && (
          <Button variant="ghost" size="icon" onClick={goBack} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb().map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                <span className={i === breadcrumb().length - 1 ? "text-foreground font-medium" : ""}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Execution Map</h1>
        </div>
      </div>

      {/* Task status summary — clickable, jumps to Tasks page filtered by status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <button
          type="button"
          onClick={() => goToTasksFilteredBy("not_started")}
          className="text-left p-4 rounded-lg border bg-muted border-border hover:shadow-md transition-shadow"
        >
          <p className="text-2xl font-display font-bold text-muted-foreground">{taskCounts.not_started}</p>
          <p className="text-xs text-muted-foreground mt-1">Not Started</p>
        </button>
        <button
          type="button"
          onClick={() => goToTasksFilteredBy("in_progress")}
          className="text-left p-4 rounded-lg border bg-warning/10 border-warning/30 hover:shadow-md transition-shadow"
        >
          <p className="text-2xl font-display font-bold text-warning">{taskCounts.in_progress}</p>
          <p className="text-xs text-muted-foreground mt-1">In Progress</p>
        </button>
        <button
          type="button"
          onClick={() => goToTasksFilteredBy("completed")}
          className="text-left p-4 rounded-lg border bg-success/10 border-success/30 hover:shadow-md transition-shadow"
        >
          <p className="text-2xl font-display font-bold text-success">{taskCounts.completed}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed</p>
        </button>
        <button
          type="button"
          onClick={() => goToTasksFilteredBy("delayed")}
          className="text-left p-4 rounded-lg border bg-destructive/10 border-destructive/30 hover:shadow-md transition-shadow"
        >
          <p className="text-2xl font-display font-bold text-destructive">{taskCounts.delayed}</p>
          <p className="text-xs text-muted-foreground mt-1">Delayed</p>
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {[
          { label: "Completed", color: "bg-success" },
          { label: "In Progress", color: "bg-warning" },
          { label: "Delayed / Blocked", color: "bg-destructive" },
          { label: "Not Started", color: "bg-muted-foreground/30" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <div className={`h-3 w-3 rounded-sm ${item.color}`} />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
          <Pencil className="h-3 w-3" /> Click any progress bar with a pencil icon to edit
        </span>
      </div>

      {/* Projects View */}
      {view === "projects" && (
        <>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground text-center">
                No projects yet. Create one from the Projects page or import one via a document
                upload.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project: ApiProject) => {
                const pTowers = towers.filter((t: ApiTower) => t.projectId === project.id);
                return (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setView("towers");
                    }}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl bg-muted/60 border flex items-center justify-center shrink-0 p-1 overflow-hidden">
                          {resolveImageUrl(project.organizationLogo) ? (
                            <img
                              src={resolveImageUrl(project.organizationLogo)!}
                              alt={project.organizationName || project.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Building2 className={`h-5 w-5 text-primary fallback-icon ${resolveImageUrl(project.organizationLogo) ? 'hidden' : ''}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-bold truncate">{project.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {[project.organizationName, project.location].filter(Boolean).join(" · ") || "No organization"}
                          </p>
                        </div>
                      </div>
                      <EditableProgress
                        value={project.progress}
                        saving={updateProjectProgress.isPending}
                        onSave={(v) => updateProjectProgress.mutate({ id: project.id, progress: v })}
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{pTowers.length} Towers</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Towers View */}
      {view === "towers" && selectedProject && (
        <>
          {towers.filter((t: ApiTower) => t.projectId === selectedProject.id).length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground text-center">
                No towers mapped yet for this project.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {towers
                .filter((t: ApiTower) => t.projectId === selectedProject.id)
                .map((tower: ApiTower) => {
                  const tFloors = floors.filter((f: ApiFloor) => f.towerId === tower.id);
                  const towerTasks = tasks.filter((t: ApiTask) => t.towerId === tower.id);
                  const towerComputedProgress = computeAvgProgress(towerTasks);

                  return (
                    <Card key={tower.id}>
                      <CardHeader className="pb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="font-display">{tower.name}</CardTitle>
                          <Badge variant="secondary">{tower.status}</Badge>
                        </div>
                        <ComputedProgress value={towerComputedProgress} />
                        <p className="text-[11px] text-muted-foreground">
                          {towerTasks.length} tasks · auto-calculated — edit a task below to change it
                        </p>
                      </CardHeader>
                      <CardContent>
                        {tFloors.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No floors mapped yet for this tower ({tower.totalFloors} expected).
                          </p>
                        ) : (
                          <div className="flex flex-col-reverse gap-2">
                            {tFloors
                              .sort((a, b) => b.number - a.number)
                              .map((floor) => {
                                const floorTasks = tasks.filter((t: ApiTask) => t.floorId === floor.id);
                                const completed = floorTasks.filter((t) => t.status === "completed").length;
                                const total = floorTasks.length;
                                const floorStatus = aggregateStatus(floorTasks);
                                const floorProgress = computeAvgProgress(floorTasks);

                                return (
                                  <button
                                    key={floor.id}
                                    onClick={() => {
                                      setSelectedTowerId(tower.id);
                                      setSelectedFloorId(floor.id);
                                      setView("units");
                                    }}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors hover:shadow-sm space-y-1.5 ${getBgColor(
                                      floorStatus
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{floor.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {completed}/{total} tasks
                                        </span>
                                        <div className={`h-2.5 w-2.5 rounded-full ${getStatusDot(floorStatus)}`} />
                                      </div>
                                    </div>
                                    <ComputedProgress value={floorProgress} barClassName="h-1.5" />
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* Units / Floor View */}
      {view === "units" && selectedFloor && (
        <div className="space-y-6">
          {/* Floor summary — computed rollup, tap a task below to change it */}
          {(() => {
            const allFloorTasks = tasks.filter((t: ApiTask) => t.floorId === selectedFloor.id);
            const floorProgress = computeAvgProgress(allFloorTasks);
            const completed = allFloorTasks.filter((t) => t.status === "completed").length;
            const floorStatus = aggregateStatus(allFloorTasks);
            return (
              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <span className="font-display font-bold">{selectedFloor.name}</span>
                      {selectedTower && (
                        <span className="text-xs text-muted-foreground">· {selectedTower.name}</span>
                      )}
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full ${getStatusDot(floorStatus)}`} />
                  </div>
                  <ComputedProgress value={floorProgress} barClassName="h-2.5" />
                  <p className="text-[11px] text-muted-foreground">
                    {completed}/{allFloorTasks.length} tasks completed · auto-calculated — edit a
                    task below to change it
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Unit cards — derived purely from distinct unitIds on this floor's
              tasks, since there's no separate units endpoint. */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from(
              new Set(
                tasks
                  .filter((t: ApiTask) => t.floorId === selectedFloor.id && t.unitId !== null)
                  .map((t) => t.unitId as number)
              )
            ).map((unitId) => {
              const unitTasks = tasks.filter(
                (t: ApiTask) => t.floorId === selectedFloor.id && t.unitId === unitId
              );
              const unitProgress = computeAvgProgress(unitTasks);
              const unitStatus = aggregateStatus(unitTasks);
              return (
                <Card key={unitId}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Grid3X3 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Unit #{unitId}</span>
                      </div>
                      <div className={`h-2.5 w-2.5 rounded-full ${getStatusDot(unitStatus)}`} />
                    </div>
                    <ComputedProgress value={unitProgress} barClassName="h-1.5" />
                    <div className="space-y-2">
                      {unitTasks.map((task) => (
                        <div key={task.id} className={`p-2 rounded-md border text-xs space-y-1 ${getBgColor(task.status)}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{task.title}</span>
                            <div className={`h-2 w-2 rounded-full shrink-0 ${getStatusDot(task.status)}`} />
                          </div>
                          <EditableProgress
                            value={task.progress}
                            barClassName="h-1"
                            saving={updateTaskProgress.isPending}
                            onSave={(v) => updateTaskProgress.mutate({ id: task.id, progress: v })}
                          />
                          <p className="text-muted-foreground">{task.department}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {tasks.filter((t: ApiTask) => t.floorId === selectedFloor.id && t.unitId !== null).length === 0 && (
              <Card className="md:col-span-2 lg:col-span-4">
                <CardContent className="p-6 text-sm text-muted-foreground text-center">
                  No unit-level tasks assigned on this floor.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Floor-level tasks (not unit-specific) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">Floor-Level Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks
                  .filter((t: ApiTask) => t.floorId === selectedFloor.id && !t.unitId)
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${getBgColor(task.status)}`}
                    >
                      <div className={`h-3 w-3 rounded-full shrink-0 ${getStatusDot(task.status)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.department} · {statusLabels[task.status as keyof typeof statusLabels]}
                        </p>
                      </div>
                      <div className="w-40 shrink-0">
                        <EditableProgress
                          value={task.progress}
                          barClassName="h-1.5"
                          saving={updateTaskProgress.isPending}
                          onSave={(v) => updateTaskProgress.mutate({ id: task.id, progress: v })}
                        />
                      </div>
                    </div>
                  ))}
                {tasks.filter((t: ApiTask) => t.floorId === selectedFloor.id && !t.unitId).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No floor-level tasks yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DigitalTwin;