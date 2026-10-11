import React from "react";
import type {
  ProjectRollup,
  DigitalTwinSelection,
  VisualizationMode,
} from "./types";
import { getElementColor } from "./digitalTwinUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Layers, Grid3X3 } from "lucide-react";

interface DigitalTwin2DElevationProps {
  projectRollup: ProjectRollup;
  visualizationMode: VisualizationMode;
  selection: DigitalTwinSelection;
  onSelect: (sel: DigitalTwinSelection) => void;
}

export const DigitalTwin2DElevation: React.FC<DigitalTwin2DElevationProps> = ({
  projectRollup,
  visualizationMode,
  selection,
  onSelect,
}) => {
  const towers = projectRollup.towers;

  if (towers.length === 0) {
    return (
      <Card className="h-full min-h-[500px] flex items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">No towers mapped to this project yet.</p>
      </Card>
    );
  }

  return (
    <div className="h-full min-h-[520px] overflow-auto p-4 bg-slate-950 border border-border/60 rounded-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-white">
            2D Architectural Elevation Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Click any floor or unit cell to inspect in the details panel
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-slate-700 text-slate-300">
          Cross-Section View
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {towers.map((towerRollup) => {
          const isTowerSelected = selection.towerId === towerRollup.tower.id;
          // Sort floors from highest floor number to lowest (top-of-building down to ground)
          const sortedFloors = [...towerRollup.floors].sort((a, b) => b.number - a.number);

          return (
            <div
              key={towerRollup.tower.id}
              className={`rounded-2xl border p-4 bg-slate-900/80 backdrop-blur-md space-y-4 transition-all ${
                isTowerSelected
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Tower Header */}
              <div
                onClick={() =>
                  onSelect({
                    scope: "tower",
                    projectId: projectRollup.project.id,
                    towerId: towerRollup.tower.id,
                    floorId: null,
                    unitId: null,
                  })
                }
                className="flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white group-hover:text-primary transition-colors">
                      {towerRollup.tower.name}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {towerRollup.floors.length} Floors • {towerRollup.progress}% Progress
                    </p>
                  </div>
                </div>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getElementColor(towerRollup, visualizationMode) }}
                />
              </div>

              {/* Floor Stack (Top to Bottom) */}
              <div className="space-y-2">
                {sortedFloors.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No floors defined.</p>
                ) : (
                  sortedFloors.map((floorRollup) => {
                    const isFloorSelected = selection.floorId === floorRollup.floor.id;
                    const floorColor = getElementColor(floorRollup, visualizationMode);

                    return (
                      <div
                        key={floorRollup.floor.id}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isFloorSelected
                            ? "border-primary/80 bg-primary/10"
                            : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
                        }`}
                      >
                        {/* Floor Row Header */}
                        <div
                          onClick={() =>
                            onSelect({
                              scope: "floor",
                              projectId: projectRollup.project.id,
                              towerId: towerRollup.tower.id,
                              floorId: floorRollup.floor.id,
                              unitId: null,
                            })
                          }
                          className="flex items-center justify-between text-xs cursor-pointer pb-1.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-200">
                              {floorRollup.floor.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              {floorRollup.completedTasks}/{floorRollup.totalTasks} Tasks ({floorRollup.progress}%)
                            </span>
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: floorColor }}
                            />
                          </div>
                        </div>

                        {/* Units Grid */}
                        {floorRollup.units.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-1">
                            {floorRollup.units.map((unitRollup) => {
                              const isUnitSelected = selection.unitId === unitRollup.unit.id;
                              const unitColor = getElementColor(unitRollup, visualizationMode);

                              return (
                                <button
                                  key={unitRollup.unit.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect({
                                      scope: "unit",
                                      projectId: projectRollup.project.id,
                                      towerId: towerRollup.tower.id,
                                      floorId: floorRollup.floor.id,
                                      unitId: unitRollup.unit.id,
                                    });
                                  }}
                                  className={`p-1.5 rounded-lg border text-center transition-all ${
                                    isUnitSelected
                                      ? "ring-2 ring-primary border-primary scale-105 z-10"
                                      : "border-slate-800 hover:border-slate-600 hover:scale-[1.02]"
                                  }`}
                                  style={{
                                    backgroundColor: `${unitColor}22`,
                                    borderColor: isUnitSelected ? "#38bdf8" : `${unitColor}66`,
                                  }}
                                  title={`Unit ${unitRollup.unit.unitNumber || unitRollup.unit.id}: ${unitRollup.progress}%`}
                                >
                                  <p className="text-[10px] font-bold text-white truncate">
                                    {unitRollup.unit.unitNumber || `#${unitRollup.unit.id}`}
                                  </p>
                                  <p className="text-[9px] font-mono text-slate-300">
                                    {unitRollup.progress}%
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic pt-0.5">
                            Whole floor scope ({floorRollup.totalTasks} tasks)
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
