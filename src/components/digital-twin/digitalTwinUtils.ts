import type {
  ApiProject,
  ApiTower,
  ApiFloor,
  ApiUnit,
  ApiTask,
  ApiChecklist,
  ApiSubTask,
} from "@/lib/api";
import type {
  VisualizationMode,
  UnitRollup,
  FloorRollup,
  TowerRollup,
  ProjectRollup,
} from "./types";

/**
 * Determine if a task is overdue or delayed
 */
export function isTaskOverdue(task: ApiTask): boolean {
  if (task.status === "completed") return false;
  if (task.status === "delayed" || task.status === "blocked") return true;
  if (task.delayDays && task.delayDays > 0) return true;
  if (task.endDate) {
    const due = new Date(task.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }
  return false;
}

/**
 * Check if a task or item is marked as completed
 */
export function isTaskCompleted(task: ApiTask): boolean {
  return task.status === "completed" || task.progress === 100;
}

export function isChecklistCompleted(c: ApiChecklist): boolean {
  return (
    c.status?.toLowerCase() === "completed" ||
    c.status?.toLowerCase() === "complete" ||
    c.progress === 100
  );
}

export function isSubTaskCompleted(s: ApiSubTask): boolean {
  return (
    s.status?.toLowerCase() === "completed" ||
    s.status?.toLowerCase() === "complete" ||
    s.progress === 100
  );
}

/**
 * Normalize status text to standard category
 */
export function normalizeStatus(rawStatus?: string): string {
  if (!rawStatus) return "not_started";
  const s = rawStatus.toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (s === "completed" || s === "done" || s === "finish") return "completed";
  if (s === "in_progress" || s === "progress" || s === "active" || s === "review" || s === "ready")
    return "in_progress";
  if (s === "delayed" || s === "blocked" || s === "on_hold" || s === "hold") return "delayed";
  return "not_started";
}

/**
 * Roll a list of tasks into an aggregated status
 */
export function aggregateTasksStatus(tasks: ApiTask[]): string {
  if (!tasks.length) return "not_started";
  const completed = tasks.filter(isTaskCompleted).length;
  if (completed === tasks.length) return "completed";
  if (tasks.some((t) => isTaskOverdue(t) || t.status === "blocked" || t.status === "delayed")) {
    return "delayed";
  }
  if (tasks.some((t) => t.status === "in_progress" || (t.progress > 0 && t.progress < 100))) {
    return "in_progress";
  }
  return "not_started";
}

/**
 * Build the full nested hierarchy tree and rollups from actual DB records
 */
export function buildProjectRollup(
  project: ApiProject,
  towers: ApiTower[],
  floors: ApiFloor[],
  units: ApiUnit[],
  tasks: ApiTask[],
  checklists: ApiChecklist[],
  subtasks: ApiSubTask[]
): ProjectRollup {
  // Scope everything to this project
  const projectTowers = towers.filter((t) => t.projectId === project.id);
  const projectFloors = floors.filter((f) => f.projectId === project.id);
  const projectUnits = units.filter((u) => u.projectId === project.id);
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectChecklists = checklists.filter((c) => c.projectId === project.id);
  const projectSubTasks = subtasks.filter((s) => s.projectId === project.id);

  const towerRollups: TowerRollup[] = projectTowers.map((tower) => {
    const towerFloors = projectFloors
      .filter((f) => f.towerId === tower.id)
      .sort((a, b) => a.number - b.number);

    const towerTasks = projectTasks.filter((t) => t.towerId === tower.id);

    const floorRollups: FloorRollup[] = towerFloors.map((floor) => {
      const floorUnits = projectUnits.filter((u) => u.floorId === floor.id);
      const floorTasksOnly = projectTasks.filter(
        (t) => t.floorId === floor.id && (t.unitId === null || t.unitId === undefined)
      );

      const unitRollups: UnitRollup[] = floorUnits.map((unit) => {
        const uTasks = projectTasks.filter((t) => t.unitId === unit.id);
        const uChecklists = projectChecklists.filter(
          (c) => c.unitId === unit.id || uTasks.some((t) => t.id === c.taskId)
        );
        const uSubtasks = projectSubTasks.filter(
          (s) => s.unitId === unit.id || uTasks.some((t) => t.id === s.taskId)
        );

        const completedTasks = uTasks.filter(isTaskCompleted).length;
        const totalTasks = uTasks.length;
        const overdueTasks = uTasks.filter(isTaskOverdue).length;
        const hasBlockers = overdueTasks > 0 || uTasks.some((t) => t.status === "blocked");

        // Compute unit progress:
        // If unit has tasks, average the task progress;
        // Also factor in checklists and subtasks if available;
        // If no tasks, fall back to unit.progress from the DB
        let computedProgress = unit.progress ?? 0;
        if (totalTasks > 0) {
          const sumTaskProg = uTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
          const avgTaskProg = sumTaskProg / totalTasks;

          if (uChecklists.length > 0) {
            const completedCh = uChecklists.filter(isChecklistCompleted).length;
            const chProg = (completedCh / uChecklists.length) * 100;
            computedProgress = Math.round(avgTaskProg * 0.7 + chProg * 0.3);
          } else {
            computedProgress = Math.round(avgTaskProg);
          }
        }

        const unitStatus =
          totalTasks > 0
            ? aggregateTasksStatus(uTasks)
            : unit.status
            ? normalizeStatus(unit.status)
            : "not_started";

        return {
          unit,
          progress: Math.min(100, Math.max(0, computedProgress)),
          status: unitStatus,
          tasks: uTasks,
          checklists: uChecklists,
          subtasks: uSubtasks,
          completedTasks,
          totalTasks,
          overdueTasks,
          hasBlockers,
        };
      });

      // Floor-level rollup
      const allFloorTasks = projectTasks.filter((t) => t.floorId === floor.id);
      const floorCompletedTasks = allFloorTasks.filter(isTaskCompleted).length;
      const floorTotalTasks = allFloorTasks.length;
      const floorOverdueTasks = allFloorTasks.filter(isTaskOverdue).length;
      const floorHasBlockers = floorOverdueTasks > 0;

      let floorProgress = 0;
      if (unitRollups.length > 0) {
        const sumUnitProgress = unitRollups.reduce((acc, u) => acc + u.progress, 0);
        const avgUnit = sumUnitProgress / unitRollups.length;
        if (floorTasksOnly.length > 0) {
          const sumFloorTasks = floorTasksOnly.reduce((acc, t) => acc + (t.progress || 0), 0);
          const avgFloorTasks = sumFloorTasks / floorTasksOnly.length;
          floorProgress = Math.round(avgUnit * 0.7 + avgFloorTasks * 0.3);
        } else {
          floorProgress = Math.round(avgUnit);
        }
      } else if (allFloorTasks.length > 0) {
        const sumProg = allFloorTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
        floorProgress = Math.round(sumProg / allFloorTasks.length);
      } else {
        floorProgress = floor.progress ?? 0;
      }

      const floorStatus =
        allFloorTasks.length > 0
          ? aggregateTasksStatus(allFloorTasks)
          : floor.status
          ? normalizeStatus(floor.status)
          : "not_started";

      return {
        floor,
        number: floor.number,
        name: floor.name,
        progress: Math.min(100, Math.max(0, floorProgress)),
        status: floorStatus,
        units: unitRollups,
        floorTasks: floorTasksOnly,
        allTasks: allFloorTasks,
        completedTasks: floorCompletedTasks,
        totalTasks: floorTotalTasks,
        overdueTasks: floorOverdueTasks,
        hasBlockers: floorHasBlockers,
      };
    });

    const allTowerTasks = towerTasks;
    const towerCompletedTasks = allTowerTasks.filter(isTaskCompleted).length;
    const towerTotalTasks = allTowerTasks.length;
    const towerOverdueTasks = allTowerTasks.filter(isTaskOverdue).length;
    const towerHasBlockers = towerOverdueTasks > 0;

    let towerProgress = tower.progress ?? 0;
    if (floorRollups.length > 0) {
      const sumFloorProg = floorRollups.reduce((acc, f) => acc + f.progress, 0);
      towerProgress = Math.round(sumFloorProg / floorRollups.length);
    } else if (allTowerTasks.length > 0) {
      const sumProg = allTowerTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
      towerProgress = Math.round(sumProg / allTowerTasks.length);
    }

    const towerStatus =
      allTowerTasks.length > 0
        ? aggregateTasksStatus(allTowerTasks)
        : tower.status
        ? normalizeStatus(tower.status)
        : "not_started";

    return {
      tower,
      progress: Math.min(100, Math.max(0, towerProgress)),
      status: towerStatus,
      floors: floorRollups,
      towerTasks,
      allTasks: allTowerTasks,
      completedTasks: towerCompletedTasks,
      totalTasks: towerTotalTasks,
      overdueTasks: towerOverdueTasks,
      hasBlockers: towerHasBlockers,
    };
  });

  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(isTaskCompleted).length;
  const overdueTasks = projectTasks.filter(isTaskOverdue).length;

  const totalChecklists = projectChecklists.length;
  const completedChecklists = projectChecklists.filter(isChecklistCompleted).length;

  const totalSubTasks = projectSubTasks.length;
  const completedSubTasks = projectSubTasks.filter(isSubTaskCompleted).length;

  let projectProgress = project.progress ?? 0;
  if (towerRollups.length > 0) {
    const sumTowerProg = towerRollups.reduce((acc, t) => acc + t.progress, 0);
    projectProgress = Math.round(sumTowerProg / towerRollups.length);
  } else if (totalTasks > 0) {
    const sumProg = projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
    projectProgress = Math.round(sumProg / totalTasks);
  }

  const projectStatus =
    totalTasks > 0
      ? aggregateTasksStatus(projectTasks)
      : project.status
      ? normalizeStatus(project.status)
      : "not_started";

  return {
    project,
    progress: Math.min(100, Math.max(0, projectProgress)),
    status: projectStatus,
    towers: towerRollups,
    projectTasks,
    allTasks: projectTasks,
    allChecklists: projectChecklists,
    allSubTasks: projectSubTasks,
    allUnits: projectUnits,
    allFloors: projectFloors,
    completedTasks,
    totalTasks,
    overdueTasks,
    completedChecklists,
    totalChecklists,
    completedSubTasks,
    totalSubTasks,
    hasBlockers: overdueTasks > 0,
  };
}

/**
 * Visual Colors definition for materials and badges
 */
export const DIGITAL_TWIN_COLORS = {
  completed: "#10b981",    // Emerald-500
  completedDark: "#059669",
  inProgress: "#f59e0b",   // Amber-500
  inProgressDark: "#d97706",
  delayed: "#ef4444",      // Red-500
  delayedDark: "#b91c1c",
  notStarted: "#64748b",   // Slate-500
  notStartedDark: "#334155",
  neutralGlass: "#94a3b8", // Slate-400
  highlight: "#38bdf8",    // Sky-400
  selected: "#8b5cf6",     // Violet-500
  accentGold: "#eab308",   // Yellow-500
  availableUnit: "#10b981",
  soldUnit: "#3b82f6",
  blockedUnit: "#f43f5e",
};

/**
 * Get color hex string for a given element based on current visualization mode
 */
export function getElementColor(
  item: {
    progress: number;
    status: string;
    totalTasks?: number;
    completedTasks?: number;
    overdueTasks?: number;
    checklists?: ApiChecklist[];
    subtasks?: ApiSubTask[];
    hasBlockers?: boolean;
    unit?: ApiUnit;
  },
  mode: VisualizationMode
): string {
  switch (mode) {
    case "overall": {
      const p = item.progress;
      if (p === 100) return DIGITAL_TWIN_COLORS.completed;
      if (p >= 75) return "#34d399"; // light emerald
      if (p >= 50) return DIGITAL_TWIN_COLORS.inProgress;
      if (p >= 25) return "#fb923c"; // orange
      if (p > 0) return "#f87171";  // coral red
      return DIGITAL_TWIN_COLORS.notStarted;
    }

    case "tasks": {
      const total = item.totalTasks ?? 0;
      if (total === 0) return DIGITAL_TWIN_COLORS.notStarted;
      const completed = item.completedTasks ?? 0;
      const ratio = completed / total;
      if (ratio === 1) return DIGITAL_TWIN_COLORS.completed;
      if (ratio >= 0.5) return DIGITAL_TWIN_COLORS.inProgress;
      if (ratio > 0) return "#fb923c";
      return "#f87171";
    }

    case "checklists": {
      const lists = item.checklists ?? [];
      if (lists.length === 0) return DIGITAL_TWIN_COLORS.notStarted;
      const comp = lists.filter(isChecklistCompleted).length;
      const ratio = comp / lists.length;
      if (ratio === 1) return DIGITAL_TWIN_COLORS.completed;
      if (ratio >= 0.5) return DIGITAL_TWIN_COLORS.inProgress;
      if (ratio > 0) return "#fb923c";
      return "#f87171";
    }

    case "subtasks": {
      const subs = item.subtasks ?? [];
      if (subs.length === 0) return DIGITAL_TWIN_COLORS.notStarted;
      const comp = subs.filter(isSubTaskCompleted).length;
      const ratio = comp / subs.length;
      if (ratio === 1) return DIGITAL_TWIN_COLORS.completed;
      if (ratio >= 0.5) return DIGITAL_TWIN_COLORS.inProgress;
      if (ratio > 0) return "#fb923c";
      return "#f87171";
    }

    case "overdue": {
      if (item.hasBlockers || (item.overdueTasks ?? 0) > 0) {
        return DIGITAL_TWIN_COLORS.delayed;
      }
      if (item.status === "completed") return DIGITAL_TWIN_COLORS.completed;
      if (item.status === "in_progress") return "#38bdf8"; // serene sky blue (on track)
      return DIGITAL_TWIN_COLORS.notStarted;
    }

    case "status": {
      const s = normalizeStatus(item.status);
      if (s === "completed") return DIGITAL_TWIN_COLORS.completed;
      if (s === "in_progress") return DIGITAL_TWIN_COLORS.inProgress;
      if (s === "delayed") return DIGITAL_TWIN_COLORS.delayed;
      return DIGITAL_TWIN_COLORS.notStarted;
    }

    case "unit_status": {
      const uStatus = item.unit?.status?.toLowerCase();
      if (uStatus === "sold") return DIGITAL_TWIN_COLORS.soldUnit;
      if (uStatus === "blocked") return DIGITAL_TWIN_COLORS.blockedUnit;
      if (uStatus === "available") return DIGITAL_TWIN_COLORS.availableUnit;
      return DIGITAL_TWIN_COLORS.notStarted;
    }

    default:
      return DIGITAL_TWIN_COLORS.notStarted;
  }
}
