import type {
  ProjectRollup,
  DigitalTwinSelection,
  VisualizationMode,
} from "./types";
import { getElementColor, sortFloorsForElevation } from "./digitalTwinUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Layers, Grid3X3, Sun, Cog, Warehouse, CheckCircle2, Clock } from "lucide-react";

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
          // Sort floors from top-of-building (Mumty -> Terrace -> Upper Floors) down to Ground and Basements
          const sortedFloors = sortFloorsForElevation(towerRollup.floors);

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

              {/* Floor Stack (Top to Bottom: Mumty -> Terrace -> Regular -> Basement) */}
              <div className="space-y-2">
                {sortedFloors.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No floors defined.</p>
                ) : (
                  sortedFloors.map((floorRollup) => {
                    const isFloorSelected = selection.floorId === floorRollup.floor.id;
                    const floorColor = getElementColor(floorRollup, visualizationMode);
                    const isMumty = floorRollup.floorType === "mumty";
                    const isTerrace = floorRollup.floorType === "terrace";
                    const isBasement = floorRollup.floorType === "basement";

                    return (
                      <div
                        key={floorRollup.floor.id}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isFloorSelected
                            ? "border-primary/90 bg-primary/15 shadow-md shadow-primary/10"
                            : isMumty
                            ? "border-purple-500/30 bg-purple-950/20 hover:border-purple-500/50"
                            : isTerrace
                            ? "border-sky-500/30 bg-sky-950/20 hover:border-sky-500/50"
                            : isBasement
                            ? "border-amber-500/25 bg-amber-950/15 hover:border-amber-500/40"
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
                          <div className="flex items-center gap-2">
                            {isMumty ? (
                              <Cog className="h-3.5 w-3.5 text-purple-400" />
                            ) : isTerrace ? (
                              <Sun className="h-3.5 w-3.5 text-sky-400" />
                            ) : isBasement ? (
                              <Warehouse className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <Layers className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            <span className="font-semibold text-slate-200">
                              {floorRollup.floor.name}
                            </span>
                            {isMumty && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/15 text-purple-300 border-purple-500/30 font-medium"
                              >
                                Rooftop Stairhead / LMR
                              </Badge>
                            )}
                            {isTerrace && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-4 bg-sky-500/15 text-sky-300 border-sky-500/30 font-medium"
                              >
                                Open Rooftop Terrace
                              </Badge>
                            )}
                            {isBasement && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-300 border-amber-500/30 font-medium"
                              >
                                Substructure
                              </Badge>
                            )}
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

                        {/* Units Grid or Rooftop / Whole Floor Scope */}
                        {floorRollup.units.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-1">
                            {floorRollup.units.map((unitRollup) => {
                              const isUnitSelected = selection.unitId === unitRollup.unit.id;
                              const unitColor = getElementColor(unitRollup, visualizationMode);
                              const isWhite = unitColor.toLowerCase() === "#ffffff" || unitColor.toLowerCase() === "#fff";

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
                                    backgroundColor: isWhite ? "rgba(255, 255, 255, 0.15)" : `${unitColor}22`,
                                    borderColor: isUnitSelected ? "#38bdf8" : isWhite ? "rgba(255, 255, 255, 0.85)" : `${unitColor}66`,
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
                          <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-slate-400 bg-slate-950/40 rounded-lg p-1.5">
                            <span className="italic text-slate-500">
                              {isMumty
                                ? "Stairhead enclosure, overhead water tank & lift machine room"
                                : isTerrace
                                ? "Open rooftop floor deck, parapet walls & utility elements"
                                : `Whole floor scope (${floorRollup.totalTasks} total tasks)`}
                            </span>
                            <span className="font-mono text-slate-300 font-medium">
                              {floorRollup.totalTasks > 0
                                ? `${floorRollup.completedTasks}/${floorRollup.totalTasks} Done`
                                : "No Tasks"}
                            </span>
                          </div>
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
