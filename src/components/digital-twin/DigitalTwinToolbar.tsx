import React from "react";
import type { VisualizationMode, CameraPreset, TowerRollup } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  RotateCcw,
  Compass,
  Building,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  Boxes,
  Split,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Box,
  MapPin,
} from "lucide-react";

export type DigitalTwinViewMode = "3d" | "map" | "split" | "2d";

interface DigitalTwinToolbarProps {
  visualizationMode: VisualizationMode;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  towers: TowerRollup[];
  isolatedTowerId: number | null;
  onIsolatedTowerChange: (towerId: number | null) => void;
  explosionFactor: number;
  onExplosionFactorChange: (val: number) => void;
  isXRayMode: boolean;
  onToggleXRay: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
  viewMode: DigitalTwinViewMode;
  onViewModeChange: (mode: DigitalTwinViewMode) => void;
}

export const DigitalTwinToolbar: React.FC<DigitalTwinToolbarProps> = ({
  visualizationMode,
  onVisualizationModeChange,
  towers,
  isolatedTowerId,
  onIsolatedTowerChange,
  explosionFactor,
  onExplosionFactorChange,
  isXRayMode,
  onToggleXRay,
  onCameraPreset,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="bg-card/70 backdrop-blur-md border border-border p-3 rounded-xl shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Visualization Color Mode Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Filter Color:</span>
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "overall", label: "Overall Progress", icon: CheckCircle2 },
              { id: "tasks", label: "Task %", icon: CheckCircle2 },
              { id: "checklists", label: "Checklists", icon: ListTodo },
              { id: "subtasks", label: "Subtasks", icon: Boxes },
              { id: "overdue", label: "Overdue & Blockers", icon: AlertTriangle },
              { id: "status", label: "Status State", icon: Layers },
              { id: "unit_status", label: "Unit Inventory", icon: Building },
            ].map((mode) => {
              const Icon = mode.icon;
              const isActive = visualizationMode === mode.id;
              return (
                <Button
                  key={mode.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onVisualizationModeChange(mode.id as VisualizationMode)}
                  className={`h-8 text-xs gap-1.5 px-2.5 transition-all ${
                    isActive
                      ? "shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{mode.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Right: View Mode Selector (3D Model / Geo Map / Split / 2D Grid) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={viewMode === "3d" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("3d")}
            className="h-8 text-xs gap-1.5 px-2.5"
            title="Interactive 3D Architectural Model"
          >
            <Box className="h-3.5 w-3.5" />
            <span>3D Model</span>
          </Button>

          <Button
            variant={viewMode === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("map")}
            className="h-8 text-xs gap-1.5 px-2.5"
            title="Geographical 3D Map with Surrounding Roads and Terrain"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Geo 3D Map</span>
          </Button>

          <Button
            variant={viewMode === "split" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("split")}
            className="h-8 text-xs gap-1.5 px-2.5"
            title="Side-by-Side 3D Model & Geographical Map"
          >
            <Split className="h-3.5 w-3.5" />
            <span>Split View</span>
          </Button>

          <Button
            variant={viewMode === "2d" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange("2d")}
            className="h-8 text-xs gap-1.5 px-2.5"
            title="2D Matrix Elevation Grid"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>2D Elevation</span>
          </Button>
        </div>
      </div>

      {/* 3D Viewport Controls (when in 3D or Split mode) */}
      {(viewMode === "3d" || viewMode === "split") && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2.5 border-t border-border/60 text-xs">
          {/* Tower Selector Filter */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">Tower Focus:</span>
            <Select
              value={isolatedTowerId ? String(isolatedTowerId) : "all"}
              onValueChange={(val) => onIsolatedTowerChange(val === "all" ? null : Number(val))}
            >
              <SelectTrigger className="h-7 w-36 text-xs bg-background/80">
                <SelectValue placeholder="All Towers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Towers</SelectItem>
                {towers.map((t) => (
                  <SelectItem key={t.tower.id} value={String(t.tower.id)}>
                    {t.tower.name} ({t.floors.length} floors)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Floor Explode Slider */}
          <div className="flex items-center gap-2.5 min-w-[200px]">
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <Split className="h-3.5 w-3.5 text-primary" />
              <span>Explode Floors:</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(explosionFactor * 100)]}
              onValueChange={([val]) => onExplosionFactorChange(val / 100)}
              className="w-24 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-muted-foreground w-7 text-right">
              {Math.round(explosionFactor * 100)}%
            </span>
          </div>

          {/* X-Ray / Glass Toggle */}
          <Button
            variant={isXRayMode ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleXRay}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            title="Toggle X-Ray Glass Transparency"
          >
            <Eye className={`h-3.5 w-3.5 ${isXRayMode ? "text-primary" : ""}`} />
            <span>X-Ray Walls</span>
          </Button>

          {/* Camera Presets & Reset */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground hidden lg:inline">Camera:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCameraPreset("orbit")}
              className="h-7 px-2 text-[11px]"
              title="Perspective 3D Orbit View"
            >
              3D
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCameraPreset("top")}
              className="h-7 px-2 text-[11px]"
              title="Top-Down Plan View"
            >
              Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCameraPreset("front")}
              className="h-7 px-2 text-[11px]"
              title="Front Elevation View"
            >
              Front
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCameraPreset("isometric")}
              className="h-7 px-2 text-[11px]"
              title="Isometric View"
            >
              Iso
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCameraPreset("orbit")}
              className="h-7 w-7 text-muted-foreground"
              title="Reset Camera View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 pt-1.5 text-[11px] text-muted-foreground border-t border-border/40">
        <span className="font-medium text-foreground">Color Key:</span>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          <span>Completed / 100%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          <span>In Progress / 50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
          <span>Delayed / Blocked / Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-slate-500" />
          <span>Not Started / Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
          <span>Selected / Highlighted</span>
        </div>
      </div>
    </div>
  );
};
