import type {
  ApiProject,
  ApiTower,
  ApiFloor,
  ApiUnit,
  ApiTask,
  ApiChecklist,
  ApiSubTask,
  User,
} from "@/lib/api";

export type VisualizationMode =
  | "overall"      // Blended overall completion %
  | "tasks"        // Task completion %
  | "checklists"   // Checklist completion %
  | "subtasks"     // Subtask completion %
  | "overdue"      // Overdue & Critical Blockers heatmap
  | "status"       // Categorical Status (Completed, In Progress, Delayed, Not Started)
  | "unit_status"; // Unit Inventory (Available, Sold, Blocked)

export type SelectionScope = "project" | "tower" | "floor" | "unit";

export interface DigitalTwinSelection {
  scope: SelectionScope;
  projectId: number;
  towerId: number | null;
  floorId: number | null;
  unitId: number | null;
}

export interface UnitRollup {
  unit: ApiUnit;
  progress: number;
  status: string;
  tasks: ApiTask[];
  checklists: ApiChecklist[];
  subtasks: ApiSubTask[];
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  hasBlockers: boolean;
}

export type FloorType = "regular" | "terrace" | "mumty" | "basement";

export interface FloorRollup {
  floor: ApiFloor;
  number: number;
  name: string;
  floorType: FloorType;
  progress: number;
  status: string;
  units: UnitRollup[];
  floorTasks: ApiTask[]; // tasks assigned to floor but no specific unit
  allTasks: ApiTask[];
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  hasBlockers: boolean;
}

export interface TowerRollup {
  tower: ApiTower;
  progress: number;
  status: string;
  floors: FloorRollup[];
  towerTasks: ApiTask[];
  allTasks: ApiTask[];
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  hasBlockers: boolean;
}

export interface ProjectRollup {
  project: ApiProject;
  progress: number;
  status: string;
  towers: TowerRollup[];
  projectTasks: ApiTask[];
  allTasks: ApiTask[];
  allChecklists: ApiChecklist[];
  allSubTasks: ApiSubTask[];
  allUnits: ApiUnit[];
  allFloors: ApiFloor[];
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  completedChecklists: number;
  totalChecklists: number;
  completedSubTasks: number;
  totalSubTasks: number;
  hasBlockers: boolean;
}

export interface HoveredElementInfo {
  type: "tower" | "floor" | "unit";
  id: number;
  name: string;
  towerName?: string;
  floorName?: string;
  floorType?: FloorType;
  progress: number;
  status: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalChecklists?: number;
  completedChecklists?: number;
  unitType?: string;
  screenX: number;
  screenY: number;
}

export type CameraPreset = "orbit" | "top" | "front" | "isometric";
