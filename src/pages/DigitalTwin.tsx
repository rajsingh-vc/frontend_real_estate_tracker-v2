import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  projectsApi,
  towersApi,
  floorsApi,
  unitsApi,
  tasksApi,
  checklistsApi,
  subTasksApi,
  usersApi,
  ApiError,
  type ApiProject,
  type ApiTower,
  type ApiFloor,
  type ApiUnit,
  type ApiTask,
  type ApiChecklist,
  type ApiSubTask,
  type User,
} from "@/lib/api";

import type {
  DigitalTwinSelection,
  VisualizationMode,
  CameraPreset,
} from "@/components/digital-twin/types";
import { buildProjectRollup } from "@/components/digital-twin/digitalTwinUtils";
import { DigitalTwinHeader } from "@/components/digital-twin/DigitalTwinHeader";
import {
  DigitalTwinToolbar,
  type DigitalTwinViewMode,
} from "@/components/digital-twin/DigitalTwinToolbar";
import { DigitalTwinCanvas3D } from "@/components/digital-twin/DigitalTwinCanvas3D";
import { DigitalTwinMapViewer } from "@/components/digital-twin/DigitalTwinMapViewer";
import { DigitalTwinDetailsPanel } from "@/components/digital-twin/DigitalTwinDetailsPanel";
import { DigitalTwin2DElevation } from "@/components/digital-twin/DigitalTwin2DElevation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, FolderPlus, Layers, FileUp, PanelRightOpen, X, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

class ViewportErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackTitle?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("DigitalTwin Viewport Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center space-y-3 bg-card border border-border rounded-xl shadow-inner">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-base text-foreground">
            {this.props.fallbackTitle || "3D Viewport Notice"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {this.state.error?.message || "An unexpected error occurred while rendering the viewport."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry Viewport
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DigitalTwin: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Selection states
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  // Visualization & Viewport Controls
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>("overall");
  const [isolatedTowerId, setIsolatedTowerId] = useState<number | null>(null);
  const [explosionFactor, setExplosionFactor] = useState<number>(0);
  const [isXRayMode, setIsXRayMode] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("orbit");
  const [viewMode, setViewMode] = useState<DigitalTwinViewMode>("3d");
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Data Queries
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErrorObj,
    refetch: refetchProjects,
  } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  const {
    data: towers = [],
    isLoading: towersLoading,
    refetch: refetchTowers,
  } = useQuery({ queryKey: ["towers"], queryFn: towersApi.list });

  const {
    data: floors = [],
    isLoading: floorsLoading,
    refetch: refetchFloors,
  } = useQuery({ queryKey: ["floors"], queryFn: floorsApi.list });

  const {
    data: units = [],
    isLoading: unitsLoading,
    refetch: refetchUnits,
  } = useQuery({ queryKey: ["units"], queryFn: unitsApi.list });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });

  const {
    data: checklists = [],
    isLoading: checklistsLoading,
    refetch: refetchChecklists,
  } = useQuery({ queryKey: ["checklists"], queryFn: checklistsApi.list });

  const {
    data: subtasks = [],
    isLoading: subtasksLoading,
    refetch: refetchSubtasks,
  } = useQuery({ queryKey: ["subtasks"], queryFn: subTasksApi.list });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const isLoading =
    projectsLoading ||
    towersLoading ||
    floorsLoading ||
    unitsLoading ||
    tasksLoading ||
    checklistsLoading ||
    subtasksLoading;

  // Auto-select first project with data if none selected
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      // Prefer a project that has towers, or default to first
      const withTowers = projects.find((p) => towers.some((t) => t.projectId === p.id));
      setSelectedProjectId(withTowers ? withTowers.id : projects[0].id);
    }
  }, [projects, towers, selectedProjectId]);

  // When changing project, clear lower-level selections
  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setSelectedTowerId(null);
    setSelectedFloorId(null);
    setSelectedUnitId(null);
    setIsolatedTowerId(null);
    setExplosionFactor(0);
  };

  // Find currently selected project
  const currentProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // Compute live project rollup hierarchy
  const projectRollup = useMemo(() => {
    if (!currentProject) return null;
    return buildProjectRollup(
      currentProject,
      towers,
      floors,
      units,
      tasks,
      checklists,
      subtasks
    );
  }, [currentProject, towers, floors, units, tasks, checklists, subtasks]);

  // Combined selection object
  const selection: DigitalTwinSelection = useMemo(() => {
    let scope: DigitalTwinSelection["scope"] = "project";
    if (selectedUnitId !== null) scope = "unit";
    else if (selectedFloorId !== null) scope = "floor";
    else if (selectedTowerId !== null) scope = "tower";

    return {
      scope,
      projectId: selectedProjectId ?? 0,
      towerId: selectedTowerId,
      floorId: selectedFloorId,
      unitId: selectedUnitId,
    };
  }, [selectedProjectId, selectedTowerId, selectedFloorId, selectedUnitId]);

  const handleSelect = (sel: DigitalTwinSelection) => {
    setSelectedTowerId(sel.towerId);
    setSelectedFloorId(sel.floorId);
    setSelectedUnitId(sel.unitId);
    setIsDetailsOpen(true);
  };

  // Mutations for updating task progress directly from Digital Twin
  const updateTaskProgressMutation = useMutation({
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
    onSuccess: () => {
      toast({ title: "Task progress updated in Digital Twin" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const toggleChecklistItemMutation = useMutation({
    mutationFn: ({ taskId, itemId }: { taskId: number; itemId: number }) =>
      tasksApi.toggleChecklistItem(taskId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Checklist item updated" });
    },
  });

  // Master refresh
  const handleRefresh = async () => {
    await Promise.all([
      refetchProjects(),
      refetchTowers(),
      refetchFloors(),
      refetchUnits(),
      refetchTasks(),
      refetchChecklists(),
      refetchSubtasks(),
    ]);
    toast({ title: "Digital Twin refreshed with live database data" });
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Building dynamic Digital Twin from database...
        </p>
      </div>
    );
  }

  if (projectsError) {
    return (
      <Card className="max-w-lg mx-auto my-16 p-6 text-center space-y-4 border-destructive/40">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <Building2 className="h-6 w-6" />
        </div>
        <CardContent className="space-y-2 p-0">
          <h3 className="font-display font-bold text-lg">Failed to load Digital Twin</h3>
          <p className="text-sm text-muted-foreground">
            {projectsErrorObj instanceof ApiError
              ? projectsErrorObj.message
              : "Backend connection error. Please ensure the backend server is running."}
          </p>
          <Button onClick={() => refetchProjects()} variant="outline" className="mt-4">
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <DigitalTwinHeader
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        projectRollup={projectRollup}
        isRefreshing={isLoading}
        onRefresh={handleRefresh}
        visualizationMode={visualizationMode}
        onVisualizationModeChange={setVisualizationMode}
        onTowerClick={() => {
          if (!projectRollup?.towers.length) return;
          if (isolatedTowerId === null) {
            const first = projectRollup.towers[0];
            setIsolatedTowerId(first.tower.id);
            toast({ title: `Focused on ${first.tower.name}` });
          } else {
            const idx = projectRollup.towers.findIndex((t) => t.tower.id === isolatedTowerId);
            if (idx >= 0 && idx < projectRollup.towers.length - 1) {
              const next = projectRollup.towers[idx + 1];
              setIsolatedTowerId(next.tower.id);
              toast({ title: `Focused on ${next.tower.name}` });
            } else {
              setIsolatedTowerId(null);
              toast({ title: "Viewing All Towers" });
            }
          }
        }}
      />

      {/* 2. Main Section: Toolbar with Visualization Filters & Camera Controls */}
      {projectRollup && (
        <DigitalTwinToolbar
          visualizationMode={visualizationMode}
          onVisualizationModeChange={setVisualizationMode}
          towers={projectRollup.towers}
          isolatedTowerId={isolatedTowerId}
          onIsolatedTowerChange={setIsolatedTowerId}
          explosionFactor={explosionFactor}
          onExplosionFactorChange={setExplosionFactor}
          isXRayMode={isXRayMode}
          onToggleXRay={() => setIsXRayMode((prev) => !prev)}
          cameraPreset={cameraPreset}
          onCameraPreset={setCameraPreset}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {/* 3. Core Viewport & Details Inspector Panel */}
      {projectRollup && projectRollup.towers.length > 0 ? (
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[550px]">
            {/* Viewport Area */}
            <div
              className={`transition-all duration-300 ${
                isDetailsOpen ? "lg:col-span-8 xl:col-span-8" : "lg:col-span-12"
              } h-[550px] sm:h-[620px] lg:h-[680px] w-full`}
            >
              <ViewportErrorBoundary fallbackTitle="Digital Twin Viewport Notice">
                {viewMode === "2d" ? (
                  <DigitalTwin2DElevation
                    projectRollup={projectRollup}
                    visualizationMode={visualizationMode}
                    selection={selection}
                    onSelect={(sel) => {
                      handleSelect(sel);
                      setMobileDrawerOpen(true);
                    }}
                  />
                ) : viewMode === "map" ? (
                  <DigitalTwinMapViewer
                    projectRollup={projectRollup}
                    selection={selection}
                    onSelect={(sel) => {
                      handleSelect(sel);
                      setMobileDrawerOpen(true);
                    }}
                    onProjectUpdated={() => {
                      refetchProjects();
                      toast({ title: "Project location updated on Digital Twin" });
                    }}
                  />
                ) : viewMode === "split" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full w-full">
                    <div className="h-[270px] md:h-full rounded-xl overflow-hidden border border-border">
                      <DigitalTwinCanvas3D
                        projectRollup={projectRollup}
                        visualizationMode={visualizationMode}
                        selection={selection}
                        onSelect={(sel) => {
                          handleSelect(sel);
                          setMobileDrawerOpen(true);
                        }}
                        isolatedTowerId={isolatedTowerId}
                        explosionFactor={explosionFactor}
                        isXRayMode={isXRayMode}
                        cameraPreset={cameraPreset}
                      />
                    </div>
                    <div className="h-[270px] md:h-full rounded-xl overflow-hidden border border-border">
                      <DigitalTwinMapViewer
                        projectRollup={projectRollup}
                        selection={selection}
                        onSelect={(sel) => {
                          handleSelect(sel);
                          setMobileDrawerOpen(true);
                        }}
                        onProjectUpdated={() => {
                          refetchProjects();
                          toast({ title: "Project location updated on Digital Twin" });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <DigitalTwinCanvas3D
                    projectRollup={projectRollup}
                    visualizationMode={visualizationMode}
                    selection={selection}
                    onSelect={(sel) => {
                      handleSelect(sel);
                      setMobileDrawerOpen(true);
                    }}
                    isolatedTowerId={isolatedTowerId}
                    explosionFactor={explosionFactor}
                    isXRayMode={isXRayMode}
                    cameraPreset={cameraPreset}
                  />
                )}
              </ViewportErrorBoundary>
            </div>

            {/* Desktop Details Panel */}
            {isDetailsOpen && (
              <div className="hidden lg:block lg:col-span-4 xl:col-span-4 h-[680px] sticky top-4">
                <DigitalTwinDetailsPanel
                  projectRollup={projectRollup}
                  selection={selection}
                  onSelect={handleSelect}
                  onClose={() => setIsDetailsOpen(false)}
                  onUpdateTaskProgress={(id, progress) =>
                    updateTaskProgressMutation.mutate({ id, progress })
                  }
                  onToggleChecklistItem={(taskId, itemId) =>
                    toggleChecklistItemMutation.mutate({ taskId, itemId })
                  }
                  users={users}
                />
              </div>
            )}
          </div>

          {/* Mobile / Tablet Floating Trigger Bar */}
          <div className="lg:hidden mt-3 flex items-center justify-between gap-2 p-3 bg-card border border-border rounded-xl shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Scope: {selection.scope.toUpperCase()}{" "}
                {selection.towerId ? `(Tower #${selection.towerId})` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Tap to view hierarchy & task checklist
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setMobileDrawerOpen(true)}
              className="gap-1.5 text-xs shrink-0"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              <span>Inspect Details</span>
            </Button>
          </div>

          {/* Mobile / Tablet Slide-Over Drawer */}
          {mobileDrawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-card border-t border-border rounded-t-2xl shadow-2xl h-[82vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm">Hierarchy & Task Details</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <DigitalTwinDetailsPanel
                    projectRollup={projectRollup}
                    selection={selection}
                    onSelect={handleSelect}
                    onClose={() => setMobileDrawerOpen(false)}
                    onUpdateTaskProgress={(id, progress) =>
                      updateTaskProgressMutation.mutate({ id, progress })
                    }
                    onToggleChecklistItem={(taskId, itemId) =>
                      toggleChecklistItemMutation.mutate({ taskId, itemId })
                    }
                    users={users}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : projectRollup && projectRollup.towers.length === 0 ? (
        /* Empty state when project has no towers/floors created yet (Requirement 2 & 8: handle missing hierarchy without inventing fake data) */
        <Card className="py-16 text-center border-dashed border-2">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 border flex items-center justify-center mx-auto text-muted-foreground">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg">No Towers Mapped Yet</h3>
              <p className="text-xs text-muted-foreground">
                Project &ldquo;{projectRollup.project.name}&rdquo; does not currently have any
                towers or building levels defined in the system. The 3D Digital Twin will
                dynamically generate once structural records are added.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/category-management")}
                className="gap-1.5 text-xs"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Configure Towers & Floors</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/documents")}
                className="gap-1.5 text-xs"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>Import via Documents</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-16 text-center">
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Select a project to view its Digital Twin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DigitalTwin;