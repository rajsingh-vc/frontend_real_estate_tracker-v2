import React from "react";
import type { ApiProject } from "@/lib/api";
import type { ProjectRollup } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Layers,
  Grid3X3,
  CheckSquare,
  ListTodo,
  AlertOctagon,
  RefreshCw,
  FolderGit2,
  MapPin,
  Calendar,
  Sparkles,
} from "lucide-react";

import type { VisualizationMode } from "./types";

interface DigitalTwinHeaderProps {
  projects: ApiProject[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  projectRollup: ProjectRollup | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  visualizationMode?: VisualizationMode;
  onVisualizationModeChange?: (mode: VisualizationMode) => void;
  onTowerClick?: () => void;
}

export const DigitalTwinHeader: React.FC<DigitalTwinHeaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  projectRollup,
  isRefreshing,
  onRefresh,
  visualizationMode,
  onVisualizationModeChange,
  onTowerClick,
}) => {
  const selectedProject = projectRollup?.project;

  return (
    <div className="space-y-4">
      {/* Top Banner & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center shrink-0 shadow-inner">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight">
                3D Digital Twin
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary bg-primary/5">
                LIVE MODEL
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
              <span>Interactive building twin mapped from real execution records</span>
            </p>
            {selectedProject && (
              <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span>
                    {selectedProject.address ? `${selectedProject.address}, ` : ""}
                    {selectedProject.city || "Mumbai"}
                    {selectedProject.state ? `, ${selectedProject.state}` : ""}
                  </span>
                </span>
                {selectedProject.latitude !== null && selectedProject.latitude !== undefined && (
                  <Badge variant="outline" className="text-[10px] font-mono bg-background/60 border-primary/30 text-primary">
                    {Number(selectedProject.latitude).toFixed(4)}°N, {Number(selectedProject.longitude).toFixed(4)}°E
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-64 sm:w-72">
            <Select
              value={selectedProjectId ? String(selectedProjectId) : ""}
              onValueChange={(val) => onSelectProject(Number(val))}
            >
              <SelectTrigger className="h-10 bg-background/80 border-border">
                <div className="flex items-center gap-2 truncate">
                  <FolderGit2 className="h-4 w-4 text-primary shrink-0" />
                  <SelectValue placeholder="Select a project..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={String(proj.id)}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-medium truncate">{proj.name}</span>
                      <span className="text-[10px] text-muted-foreground">({proj.progress}%)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 shrink-0"
            title="Refresh Digital Twin Data"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Selected Project Meta & Metrics Cards - All Interactive & Clickable */}
      {selectedProject && projectRollup && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* 1. Overall Progress */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onVisualizationModeChange?.("overall")}
            className={`col-span-2 sm:col-span-1 bg-gradient-to-br from-card via-card to-primary/5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none ${
              visualizationMode === "overall"
                ? "ring-2 ring-primary border-primary shadow-sm"
                : "border-primary/20 hover:border-primary/50"
            }`}
            title="Click to color model by Overall Progress"
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Project Progress</span>
                <span className="text-sm font-bold text-primary">{projectRollup.progress}%</span>
              </div>
              <Progress value={projectRollup.progress} className="h-2 bg-muted" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="capitalize">{projectRollup.status.replace("_", " ")}</span>
                <span className="text-[10px] text-primary font-medium">Filter View ↗</span>
              </div>
            </CardContent>
          </Card>

          {/* 2. Towers */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onTowerClick?.()}
            className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none hover:border-sky-500/50"
            title="Click to cycle or focus Tower views"
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-sky-500" />
                  <span>Towers</span>
                </div>
                <span className="text-[10px] text-sky-500 font-medium">Focus ↗</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">
                {projectRollup.towers.length}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {projectRollup.towers.map((t) => t.tower.name).join(", ") || "No towers"}
              </p>
            </CardContent>
          </Card>

          {/* 3. Floors & Units */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onVisualizationModeChange?.("unit_status")}
            className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none ${
              visualizationMode === "unit_status"
                ? "ring-2 ring-indigo-500 border-indigo-500 shadow-sm"
                : "hover:border-indigo-500/50"
            }`}
            title="Click to filter 3D model by Unit Inventory (Available / Sold / Blocked)"
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Floors / Units</span>
                </div>
                <span className="text-[10px] text-indigo-500 font-medium">Inventory ↗</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">
                {projectRollup.allFloors.length}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {projectRollup.allUnits.length}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {projectRollup.allUnits.length} mapped units
              </p>
            </CardContent>
          </Card>

          {/* 4. Total Tasks */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onVisualizationModeChange?.("tasks")}
            className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none ${
              visualizationMode === "tasks"
                ? "ring-2 ring-emerald-500 border-emerald-500 shadow-sm"
                : "hover:border-emerald-500/50"
            }`}
            title="Click to filter 3D model by Task % completion"
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Tasks</span>
                </div>
                <span className="text-[10px] text-emerald-500 font-medium">Task % ↗</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">
                {projectRollup.completedTasks}
                <span className="text-sm font-normal text-muted-foreground">
                  /{projectRollup.totalTasks}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {projectRollup.totalTasks > 0
                  ? `${Math.round((projectRollup.completedTasks / projectRollup.totalTasks) * 100)}% completed`
                  : "No tasks"}
              </p>
            </CardContent>
          </Card>

          {/* 5. Checklists & Subtasks */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onVisualizationModeChange?.("checklists")}
            className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none ${
              visualizationMode === "checklists"
                ? "ring-2 ring-amber-500 border-amber-500 shadow-sm"
                : "hover:border-amber-500/50"
            }`}
            title="Click to filter 3D model by Checklists"
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ListTodo className="h-3.5 w-3.5 text-amber-500" />
                  <span>Checklists / Subs</span>
                </div>
                <span className="text-[10px] text-amber-500 font-medium">Checklists ↗</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">
                {projectRollup.totalChecklists}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}· {projectRollup.totalSubTasks}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {projectRollup.completedChecklists} checklists passed
              </p>
            </CardContent>
          </Card>

          {/* 6. Overdue / Critical Blockers */}
          <Card
            role="button"
            tabIndex={0}
            onClick={() => onVisualizationModeChange?.("overdue")}
            className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] select-none ${
              visualizationMode === "overdue"
                ? "ring-2 ring-rose-500 border-rose-500 shadow-sm"
                : projectRollup.overdueTasks > 0
                ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60"
                : "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50"
            }`}
            title="Click to highlight Overdue Tasks & Blockers on the 3D model"
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {projectRollup.overdueTasks > 0 ? (
                    <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <span className={projectRollup.overdueTasks > 0 ? "text-rose-600 font-medium dark:text-rose-400" : "text-emerald-600 font-medium dark:text-emerald-400"}>
                    {projectRollup.overdueTasks > 0 ? "Attention" : "On Track"}
                  </span>
                </div>
                <span className={`text-[10px] font-medium ${projectRollup.overdueTasks > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                  Highlight ↗
                </span>
              </div>
              <p className={`text-2xl font-display font-bold ${projectRollup.overdueTasks > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {projectRollup.overdueTasks}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {projectRollup.overdueTasks > 0 ? "Overdue / blocked tasks" : "Zero delays recorded"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};


