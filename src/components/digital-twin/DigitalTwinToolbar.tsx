import React from "react";
import type { VisualizationMode, CameraPreset, TowerRollup } from "./types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Palette,
  Info,
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
  cameraPreset?: CameraPreset;
  onCameraPreset: (preset: CameraPreset) => void;
  viewMode: DigitalTwinViewMode;
  onViewModeChange: (mode: DigitalTwinViewMode) => void;
}

const COLOR_MODES: { id: VisualizationMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overall", label: "Overall Progress", icon: CheckCircle2 },
  { id: "tasks", label: "Task %", icon: CheckCircle2 },
  { id: "checklists", label: "Checklists", icon: ListTodo },
  { id: "subtasks", label: "Subtasks", icon: Boxes },
  { id: "overdue", label: "Overdue & Blockers", icon: AlertTriangle },
  { id: "status", label: "Status State", icon: Layers },
  { id: "unit_status", label: "Unit Inventory", icon: Building },
];

const VIEW_MODES: { id: DigitalTwinViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "3d", label: "3D Model", icon: Box },
  { id: "map", label: "Geo 3D Map", icon: MapPin },
  { id: "split", label: "Split View", icon: Split },
  { id: "2d", label: "2D Elevation", icon: LayoutGrid },
];

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
  cameraPreset = "orbit",
  onCameraPreset,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="bg-card/75 backdrop-blur-md border border-border p-2.5 sm:p-3 rounded-2xl shadow-sm">
      {/* Primary Toolbar - Smooth, Evenly Aligned Layout */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
        {/* 1. View Mode Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">
            View:
          </span>
          <Select
            value={viewMode}
            onValueChange={(val) => onViewModeChange(val as DigitalTwinViewMode)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-background/80 border-border">
              <SelectValue placeholder="View Mode" />
            </SelectTrigger>
            <SelectContent>
              {VIEW_MODES.map((vm) => {
                const Icon = vm.icon;
                return (
                  <SelectItem key={vm.id} value={vm.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{vm.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Color Filter Dropdown (Exact One Icon, Full Text) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">
            Filter:
          </span>
          <Select
            value={visualizationMode}
            onValueChange={(val) => onVisualizationModeChange(val as VisualizationMode)}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs font-medium bg-background/80 border-border">
              <SelectValue placeholder="Color Filter" />
            </SelectTrigger>
            <SelectContent>
              {COLOR_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <SelectItem key={mode.id} value={mode.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{mode.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Subtle separator */}
        <div className="h-4 w-px bg-border/60 mx-0.5 hidden lg:block shrink-0" />

        {/* 3D-specific Controls (Visible when in 3D or Split view) */}
        {(viewMode === "3d" || viewMode === "split") && (
          <>
            {/* 3. Tower Focus Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Select
                value={isolatedTowerId ? String(isolatedTowerId) : "all"}
                onValueChange={(val) => onIsolatedTowerChange(val === "all" ? null : Number(val))}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs bg-background/80 border-border">
                  <SelectValue placeholder="All Towers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>All Towers</span>
                    </div>
                  </SelectItem>
                  {towers.map((t) => (
                    <SelectItem key={t.tower.id} value={String(t.tower.id)} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{t.tower.name} ({t.floors.length} fl)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Camera Preset Dropdown */}
            <div className="flex items-center gap-1 shrink-0">
              <Select value={cameraPreset || "orbit"} onValueChange={(val) => onCameraPreset(val as CameraPreset)}>
                <SelectTrigger className="h-8 w-[125px] text-xs bg-background/80 border-border" title="Select Camera Angle">
                  <SelectValue placeholder="Camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orbit" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>3D Orbit</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="top" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Top Plan</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="front" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Front View</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="isometric" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Isometric</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCameraPreset("orbit")}
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                title="Reset Camera Angle"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* 5. Explode Floors Slider */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-background/70 border border-border text-xs shrink-0">
              <span className="text-muted-foreground flex items-center gap-1 shrink-0">
                <Split className="h-3 w-3 text-primary" />
                <span>Explode:</span>
              </span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Math.round(explosionFactor * 100)]}
                onValueChange={([val]) => onExplosionFactorChange(val / 100)}
                className="w-16 sm:w-20 cursor-pointer"
              />
              <span className="text-[11px] font-mono text-muted-foreground w-6 text-right">
                {Math.round(explosionFactor * 100)}%
              </span>
            </div>

            {/* 6. X-Ray Toggle */}
            <Button
              variant={isXRayMode ? "secondary" : "outline"}
              size="sm"
              onClick={onToggleXRay}
              className={`h-8 text-xs gap-1.5 px-2.5 shrink-0 ${
                isXRayMode ? "border-primary/50 text-primary font-semibold" : "text-muted-foreground"
              }`}
              title="Toggle X-Ray Glass Transparency"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>X-Ray</span>
            </Button>
          </>
        )}

        {/* 7. Color Key / Legend Popover */}
        <div className="ml-auto shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                title="View Color Key Legend"
              >
                <Palette className="h-3.5 w-3.5 text-primary" />
                <span>Legend</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground border-b border-border pb-1.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>Color Key Legend</span>
              </div>
              <div className="space-y-2 pt-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-emerald-500 shadow-xs" />
                    <span>Completed / 100%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-amber-500 shadow-xs" />
                    <span>In Progress / 50%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-rose-500 shadow-xs" />
                    <span>Delayed / Blocked / Overdue</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-slate-500 shadow-xs" />
                    <span>Not Started / Available</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-sky-500 shadow-xs" />
                    <span>Selected / Highlighted</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
