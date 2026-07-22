// demo-data.ts

// ===== TYPES =====
export type TaskStatus = 'not_started' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'completed' | 'delayed';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type HurdleSeverity = 'critical' | 'high' | 'medium' | 'low';
export type HurdleType = 'material_delay' | 'labour_shortage' | 'vendor_delay' | 'approval_pending' | 'design_change' | 'equipment_failure' | 'weather_delay';
export type Department = 'Civil' | 'Electrical' | 'Plumbing' | 'Finishing' | 'MEP' | 'Fire Safety' | 'Structural' | 'Legal' | 'Admin';
export type UserRole = 'CEO' | 'Project Director' | 'HOD' | 'Site Engineer' | 'Vendor' | 'Admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: Department;
  avatar?: string;
  email: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  department: Department;
  assignedHOD: string;
  assignedUsers: string[];
  startDate: string;
  endDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];
  checklist: ChecklistItem[];
  progress: number;
  delayDays: number;
  delayReason?: string;
  criticalPath: boolean;
  projectId: string;
  towerId: string;
  floorId: string;
  unitId?: string;
  phase: string;
  comments: { user: string; text: string; date: string }[];
}

export interface Unit {
  id: string;
  name: string;
  floorId: string;
  towerId: string;
  projectId: string;
  type: string;
  area: number;
  tasks: string[];
}

export interface Floor {
  id: string;
  name: string;
  number: number;
  towerId: string;
  projectId: string;
  units: string[];
}

export interface Tower {
  id: string;
  name: string;
  projectId: string;
  totalFloors: number;
  floors: string[];
  progress: number;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  startDate: string;
  endDate: string;
  progress: number;
  towers: string[];
  totalUnits: number;
  reraNumber: string;
  developer: string;
  budget: number;
  spent: number;
}

export interface Hurdle {
  id: string;
  title: string;
  description: string;
  type: HurdleType;
  affectedTaskId: string;
  affectedTower: string;
  responsibleDepartment: Department;
  impactDays: number;
  severity: HurdleSeverity;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  resolutionNotes?: string;
  projectId: string;
  reportedDate: string;
  resolvedDate?: string;
}

export interface Resource {
  taskId: string;
  labour: number;
  machines: { name: string; qty: number }[];
  materials: { name: string; qty: number; unit: string }[];
  vendor?: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  category: string;
  items: string[];
}

// ----- HELPER: shift dates by +2 years -----
function shiftDate(dateStr: string, years: number = 2): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

// ===== USERS (unchanged) =====
export const users: User[] = [
  { id: 'u1', name: 'Rajesh Sharma', role: 'CEO', department: 'Admin', email: 'rajesh@vibe.com' },
  { id: 'u2', name: 'Priya Mehta', role: 'Project Director', department: 'Admin', email: 'priya@vibe.com' },
  { id: 'u3', name: 'Amit Patel', role: 'HOD', department: 'Civil', email: 'amit@vibe.com' },
  { id: 'u4', name: 'Sunita Rao', role: 'HOD', department: 'Electrical', email: 'sunita@vibe.com' },
  { id: 'u5', name: 'Vikram Singh', role: 'HOD', department: 'Plumbing', email: 'vikram@vibe.com' },
  { id: 'u6', name: 'Deepak Kumar', role: 'Site Engineer', department: 'Civil', email: 'deepak@vibe.com' },
  { id: 'u7', name: 'Anita Joshi', role: 'Site Engineer', department: 'Electrical', email: 'anita@vibe.com' },
  { id: 'u8', name: 'Rahul Gupta', role: 'Site Engineer', department: 'Plumbing', email: 'rahul@vibe.com' },
  { id: 'u9', name: 'Suresh Verma', role: 'HOD', department: 'Finishing', email: 'suresh@vibe.com' },
  { id: 'u10', name: 'Pooja Desai', role: 'HOD', department: 'Fire Safety', email: 'pooja@vibe.com' },
  { id: 'u11', name: 'Kiran Patil', role: 'Vendor', department: 'MEP', email: 'kiran@vendor.com' },
  { id: 'u12', name: 'Manoj Tiwari', role: 'Site Engineer', department: 'Finishing', email: 'manoj@vibe.com' },
];

// ===== PROJECTS (dates shifted +2 years) =====
const rawProjects: Project[] = [
  {
    id: 'p1', name: 'Marine Heights', location: 'Worli, Mumbai', status: 'active',
    startDate: '2024-01-15', endDate: '2026-12-31', progress: 42,
    towers: ['t1', 't2'], totalUnits: 240, reraNumber: 'P51900028372',
    developer: 'Vibe Group', budget: 850000000, spent: 357000000,
  },
  {
    id: 'p2', name: 'Skyline Residences', location: 'Andheri West, Mumbai', status: 'active',
    startDate: '2024-06-01', endDate: '2027-06-30', progress: 28,
    towers: ['t3', 't4', 't5'], totalUnits: 360, reraNumber: 'P51900031245',
    developer: 'Vibe Group', budget: 1200000000, spent: 336000000,
  },
  {
    id: 'p3', name: 'Palm Gardens', location: 'Thane West', status: 'planning',
    startDate: '2025-03-01', endDate: '2028-03-31', progress: 8,
    towers: ['t6'], totalUnits: 120, reraNumber: 'P51900034567',
    developer: 'Vibe Group', budget: 450000000, spent: 36000000,
  },
];

export const projects = rawProjects.map(p => ({
  ...p,
  startDate: shiftDate(p.startDate),
  endDate: shiftDate(p.endDate),
}));

// ===== TOWERS (unchanged) =====
export const towers: Tower[] = [
  { id: 't1', name: 'Tower A', projectId: 'p1', totalFloors: 30, floors: ['f1','f2','f3','f4','f5'], progress: 48, status: 'Construction' },
  { id: 't2', name: 'Tower B', projectId: 'p1', totalFloors: 25, floors: ['f6','f7','f8','f9','f10'], progress: 35, status: 'Construction' },
  { id: 't3', name: 'Tower A', projectId: 'p2', totalFloors: 35, floors: ['f11','f12','f13'], progress: 32, status: 'Construction' },
  { id: 't4', name: 'Tower B', projectId: 'p2', totalFloors: 35, floors: ['f14','f15','f16'], progress: 25, status: 'Foundation' },
  { id: 't5', name: 'Tower C', projectId: 'p2', totalFloors: 28, floors: ['f17','f18'], progress: 20, status: 'Foundation' },
  { id: 't6', name: 'Tower A', projectId: 'p3', totalFloors: 20, floors: ['f19','f20'], progress: 8, status: 'Planning' },
];

// ===== FLOORS (unchanged) =====
export const floors: Floor[] = [
  { id: 'f1', name: 'Floor 1', number: 1, towerId: 't1', projectId: 'p1', units: ['un1','un2','un3','un4'] },
  { id: 'f2', name: 'Floor 2', number: 2, towerId: 't1', projectId: 'p1', units: ['un5','un6','un7','un8'] },
  { id: 'f3', name: 'Floor 5', number: 5, towerId: 't1', projectId: 'p1', units: ['un9','un10','un11','un12'] },
  { id: 'f4', name: 'Floor 10', number: 10, towerId: 't1', projectId: 'p1', units: ['un13','un14','un15','un16'] },
  { id: 'f5', name: 'Floor 12', number: 12, towerId: 't1', projectId: 'p1', units: ['un17','un18','un19','un20'] },
  { id: 'f6', name: 'Floor 1', number: 1, towerId: 't2', projectId: 'p1', units: ['un21','un22','un23','un24'] },
  { id: 'f7', name: 'Floor 2', number: 2, towerId: 't2', projectId: 'p1', units: ['un25','un26'] },
  { id: 'f8', name: 'Floor 5', number: 5, towerId: 't2', projectId: 'p1', units: ['un27','un28'] },
  { id: 'f9', name: 'Floor 8', number: 8, towerId: 't2', projectId: 'p1', units: ['un29','un30'] },
  { id: 'f10', name: 'Floor 10', number: 10, towerId: 't2', projectId: 'p1', units: ['un31','un32'] },
  { id: 'f11', name: 'Floor 1', number: 1, towerId: 't3', projectId: 'p2', units: ['un33','un34'] },
  { id: 'f12', name: 'Floor 5', number: 5, towerId: 't3', projectId: 'p2', units: ['un35','un36'] },
  { id: 'f13', name: 'Floor 10', number: 10, towerId: 't3', projectId: 'p2', units: ['un37','un38'] },
  { id: 'f14', name: 'Floor 1', number: 1, towerId: 't4', projectId: 'p2', units: ['un39','un40'] },
  { id: 'f15', name: 'Floor 3', number: 3, towerId: 't4', projectId: 'p2', units: ['un41','un42'] },
  { id: 'f16', name: 'Floor 5', number: 5, towerId: 't4', projectId: 'p2', units: ['un43','un44'] },
  { id: 'f17', name: 'Floor 1', number: 1, towerId: 't5', projectId: 'p2', units: ['un45','un46'] },
  { id: 'f18', name: 'Floor 3', number: 3, towerId: 't5', projectId: 'p2', units: ['un47','un48'] },
  { id: 'f19', name: 'Floor 1', number: 1, towerId: 't6', projectId: 'p3', units: ['un49','un50'] },
  { id: 'f20', name: 'Floor 2', number: 2, towerId: 't6', projectId: 'p3', units: ['un51','un52'] },
];

// ===== UNITS (unchanged) =====
const unitTypes = ['1BHK', '2BHK', '3BHK', '4BHK'];
const unitAreas = [550, 850, 1200, 1600];
export const units: Unit[] = Array.from({ length: 52 }, (_, i) => {
  const id = `un${i + 1}`;
  const typeIdx = i % 4;
  const floor = floors.find(f => f.units.includes(id))!;
  return {
    id, name: `Unit ${(floor?.number || 1) * 100 + (i % 4) + 1}`,
    floorId: floor?.id || 'f1', towerId: floor?.towerId || 't1', projectId: floor?.projectId || 'p1',
    type: unitTypes[typeIdx], area: unitAreas[typeIdx], tasks: [],
  };
});

// ===== TASKS (all dates shifted +2 years) =====
const rawTasks: Task[] = [
  // Marine Heights - Tower A tasks
  {
    id: 'task1', title: 'Foundation Excavation', description: 'Complete excavation for Tower A foundation',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-02-01', endDate: '2024-04-15', actualStartDate: '2024-02-05', actualEndDate: '2024-04-20',
    priority: 'critical', status: 'completed', dependencies: [], progress: 100, delayDays: 5,
    delayReason: 'Monsoon delay', criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Foundation',
    checklist: [
      { id: 'c1', title: 'Site survey completed', completed: true },
      { id: 'c2', title: 'Soil testing done', completed: true },
      { id: 'c3', title: 'Excavation plan approved', completed: true },
      { id: 'c4', title: 'Safety barriers installed', completed: true },
    ],
    comments: [{ user: 'Amit Patel', text: 'Excavation completed with minor delays due to rain', date: '2024-04-20' }],
  },
  {
    id: 'task2', title: 'RCC Foundation', description: 'RCC foundation work for Tower A',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-04-20', endDate: '2024-07-30', actualStartDate: '2024-04-25',
    priority: 'critical', status: 'completed', dependencies: ['task1'], progress: 100, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Foundation',
    checklist: [
      { id: 'c5', title: 'Rebar placement done', completed: true },
      { id: 'c6', title: 'Formwork installed', completed: true },
      { id: 'c7', title: 'Concrete pouring done', completed: true },
      { id: 'c8', title: 'Curing completed', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task3', title: 'Structural Column Work - F1', description: 'Column casting for Floor 1',
    department: 'Structural', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-08-01', endDate: '2024-09-15', actualStartDate: '2024-08-03',
    priority: 'high', status: 'completed', dependencies: ['task2'], progress: 100, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Structure',
    checklist: [
      { id: 'c9', title: 'Column layout marked', completed: true },
      { id: 'c10', title: 'Rebar tied', completed: true },
      { id: 'c11', title: 'Column casting done', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task4', title: 'Slab Casting - Floor 1', description: 'Slab casting for Floor 1, Tower A',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-09-16', endDate: '2024-10-30', actualStartDate: '2024-09-18',
    priority: 'high', status: 'completed', dependencies: ['task3'], progress: 100, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Structure',
    checklist: [
      { id: 'c12', title: 'Shuttering done', completed: true },
      { id: 'c13', title: 'Slab rebar placed', completed: true },
      { id: 'c14', title: 'Concrete poured', completed: true },
      { id: 'c15', title: 'De-shuttering done', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task5', title: 'Slab Casting - Floor 2', description: 'Slab casting for Floor 2',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-11-01', endDate: '2024-12-15', actualStartDate: '2024-11-05',
    priority: 'high', status: 'completed', dependencies: ['task4'], progress: 100, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f2', phase: 'Structure',
    checklist: [
      { id: 'c16', title: 'Shuttering done', completed: true },
      { id: 'c17', title: 'Concrete poured', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task6', title: 'Electrical Conduit - Floor 1', description: 'Electrical conduit installation Floor 1',
    department: 'Electrical', assignedHOD: 'u4', assignedUsers: ['u7'],
    startDate: '2024-11-01', endDate: '2024-12-30',
    priority: 'medium', status: 'completed', dependencies: ['task4'], progress: 100, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'MEP',
    checklist: [
      { id: 'c18', title: 'Layout marking', completed: true },
      { id: 'c19', title: 'Conduit installed', completed: true },
      { id: 'c20', title: 'Wiring pulled', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task7', title: 'Plumbing Rough-in - Floor 1', description: 'Plumbing rough-in for Floor 1 units',
    department: 'Plumbing', assignedHOD: 'u5', assignedUsers: ['u8'],
    startDate: '2024-11-15', endDate: '2025-01-15',
    priority: 'medium', status: 'completed', dependencies: ['task4'], progress: 100, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'MEP',
    checklist: [
      { id: 'c21', title: 'Pipe layout done', completed: true },
      { id: 'c22', title: 'Pressure tested', completed: true },
    ],
    comments: [],
  },
  {
    id: 'task8', title: 'Slab Casting - Floor 5', description: 'Structural slab for Floor 5',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2025-01-15', endDate: '2025-03-15', actualStartDate: '2025-01-20',
    priority: 'high', status: 'in_progress', dependencies: ['task5'], progress: 65, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f3', phase: 'Structure',
    checklist: [
      { id: 'c23', title: 'Shuttering done', completed: true },
      { id: 'c24', title: 'Rebar placed', completed: true },
      { id: 'c25', title: 'Concrete pour', completed: false },
    ],
    comments: [{ user: 'Deepak Kumar', text: 'Rebar inspection passed. Pour scheduled for next week.', date: '2025-03-05' }],
  },
  {
    id: 'task9', title: 'Electrical Conduit - Floor 2', description: 'Electrical work on Floor 2',
    department: 'Electrical', assignedHOD: 'u4', assignedUsers: ['u7'],
    startDate: '2025-01-01', endDate: '2025-02-28',
    priority: 'medium', status: 'in_progress', dependencies: ['task5'], progress: 72, delayDays: 3,
    delayReason: 'Material shortage', criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f2', phase: 'MEP',
    checklist: [
      { id: 'c26', title: 'Layout marking', completed: true },
      { id: 'c27', title: 'Conduit installed', completed: true },
      { id: 'c28', title: 'Wiring pulled', completed: false },
      { id: 'c29', title: 'Inspection', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task10', title: 'Plumbing Installation - Unit 1203', description: 'Kitchen & bathroom plumbing for Unit 1203',
    department: 'Plumbing', assignedHOD: 'u5', assignedUsers: ['u8'],
    startDate: '2025-02-01', endDate: '2025-04-15',
    priority: 'medium', status: 'in_progress', dependencies: [], progress: 40, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f5', unitId: 'un17', phase: 'MEP',
    checklist: [
      { id: 'c30', title: 'Kitchen plumbing layout', completed: true },
      { id: 'c31', title: 'Kitchen pipe installation', completed: true },
      { id: 'c32', title: 'Bathroom plumbing layout', completed: false },
      { id: 'c33', title: 'Bathroom pipe installation', completed: false },
      { id: 'c34', title: 'Pressure testing', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task11', title: 'Electrical Wiring - Unit 1203', description: 'Complete electrical wiring for Unit 1203',
    department: 'Electrical', assignedHOD: 'u4', assignedUsers: ['u7'],
    startDate: '2025-02-15', endDate: '2025-04-30',
    priority: 'medium', status: 'not_started', dependencies: [], progress: 0, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f5', unitId: 'un17', phase: 'MEP',
    checklist: [
      { id: 'c35', title: 'Switch board layout', completed: false },
      { id: 'c36', title: 'Wiring installation', completed: false },
      { id: 'c37', title: 'Earthing completed', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task12', title: 'Bathroom Waterproofing - Unit 1203', description: 'Waterproofing treatment for all bathrooms',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2025-03-01', endDate: '2025-04-15',
    priority: 'high', status: 'not_started', dependencies: ['task10'], progress: 0, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f5', unitId: 'un17', phase: 'Finishing',
    checklist: [
      { id: 'c38', title: 'Surface preparation', completed: false },
      { id: 'c39', title: 'Waterproofing coat applied', completed: false },
      { id: 'c40', title: 'Water ponding test', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task13', title: 'Slab Casting - Floor 10', description: 'Structural slab work Floor 10',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2025-04-01', endDate: '2025-06-01',
    priority: 'high', status: 'not_started', dependencies: ['task8'], progress: 0, delayDays: 0,
    criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f4', phase: 'Structure',
    checklist: [], comments: [],
  },
  {
    id: 'task14', title: 'Interior Plastering - Floor 1', description: 'Internal wall plastering Floor 1',
    department: 'Finishing', assignedHOD: 'u9', assignedUsers: ['u12'],
    startDate: '2025-02-01', endDate: '2025-03-30',
    priority: 'medium', status: 'in_progress', dependencies: ['task6', 'task7'], progress: 55, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Finishing',
    checklist: [
      { id: 'c41', title: 'Wall preparation', completed: true },
      { id: 'c42', title: 'First coat', completed: true },
      { id: 'c43', title: 'Second coat', completed: false },
      { id: 'c44', title: 'Curing', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task15', title: 'Fire Safety Installation - Floor 1', description: 'Fire alarm and sprinkler system',
    department: 'Fire Safety', assignedHOD: 'u10', assignedUsers: ['u7'],
    startDate: '2025-03-01', endDate: '2025-05-15',
    priority: 'high', status: 'ready', dependencies: ['task6'], progress: 0, delayDays: 0,
    criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'MEP',
    checklist: [
      { id: 'c45', title: 'Sprinkler layout approved', completed: false },
      { id: 'c46', title: 'Pipe installation', completed: false },
      { id: 'c47', title: 'Alarm system installed', completed: false },
      { id: 'c48', title: 'Testing completed', completed: false },
    ],
    comments: [],
  },
  // Tower B tasks
  {
    id: 'task16', title: 'Foundation Work - Tower B', description: 'Complete foundation for Tower B',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-04-01', endDate: '2024-08-30', actualStartDate: '2024-04-10', actualEndDate: '2024-09-10',
    priority: 'critical', status: 'completed', dependencies: [], progress: 100, delayDays: 10,
    delayReason: 'Rock bed encountered during excavation', criticalPath: true, projectId: 'p1', towerId: 't2', floorId: 'f6', phase: 'Foundation',
    checklist: [], comments: [],
  },
  {
    id: 'task17', title: 'Structural Work - Tower B F1-F2', description: 'Structural columns and slabs',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-09-15', endDate: '2025-01-30', actualStartDate: '2024-09-20',
    priority: 'high', status: 'in_progress', dependencies: ['task16'], progress: 78, delayDays: 5,
    delayReason: 'Labour shortage during Diwali', criticalPath: true, projectId: 'p1', towerId: 't2', floorId: 'f6', phase: 'Structure',
    checklist: [], comments: [],
  },
  {
    id: 'task18', title: 'MEP Rough-in - Tower B F1', description: 'All MEP rough-in work for Tower B Floor 1',
    department: 'MEP', assignedHOD: 'u5', assignedUsers: ['u8', 'u7'],
    startDate: '2025-01-01', endDate: '2025-03-30',
    priority: 'medium', status: 'blocked', dependencies: ['task17'], progress: 15, delayDays: 12,
    delayReason: 'Waiting for structural completion', criticalPath: false, projectId: 'p1', towerId: 't2', floorId: 'f6', phase: 'MEP',
    checklist: [], comments: [{ user: 'Vikram Singh', text: 'Blocked due to structural work delay', date: '2025-02-15' }],
  },
  // Skyline Residences tasks
  {
    id: 'task19', title: 'Foundation - Skyline Tower A', description: 'Foundation excavation and RCC',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-07-01', endDate: '2024-12-31', actualStartDate: '2024-07-10', actualEndDate: '2025-01-15',
    priority: 'critical', status: 'completed', dependencies: [], progress: 100, delayDays: 15,
    delayReason: 'Heavy monsoon', criticalPath: true, projectId: 'p2', towerId: 't3', floorId: 'f11', phase: 'Foundation',
    checklist: [], comments: [],
  },
  {
    id: 'task20', title: 'Structural - Skyline Tower A', description: 'Structural work up to Floor 5',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2025-01-20', endDate: '2025-08-30',
    priority: 'critical', status: 'in_progress', dependencies: ['task19'], progress: 35, delayDays: 0,
    criticalPath: true, projectId: 'p2', towerId: 't3', floorId: 'f12', phase: 'Structure',
    checklist: [], comments: [],
  },
  {
    id: 'task21', title: 'Foundation - Skyline Tower B', description: 'Foundation for Tower B',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-09-01', endDate: '2025-02-28',
    priority: 'high', status: 'in_progress', dependencies: [], progress: 82, delayDays: 0,
    criticalPath: true, projectId: 'p2', towerId: 't4', floorId: 'f14', phase: 'Foundation',
    checklist: [], comments: [],
  },
  {
    id: 'task22', title: 'RERA Registration - Palm Gardens', description: 'Complete RERA registration process',
    department: 'Legal', assignedHOD: 'u2', assignedUsers: ['u2'],
    startDate: '2025-01-15', endDate: '2025-03-31',
    priority: 'critical', status: 'in_progress', dependencies: [], progress: 60, delayDays: 0,
    criticalPath: true, projectId: 'p3', towerId: 't6', floorId: 'f19', phase: 'Pre-Construction',
    checklist: [
      { id: 'c49', title: 'Documentation prepared', completed: true },
      { id: 'c50', title: 'Application submitted', completed: true },
      { id: 'c51', title: 'Fees paid', completed: true },
      { id: 'c52', title: 'Certificate received', completed: false },
    ],
    comments: [],
  },
  {
    id: 'task23', title: 'Soil Testing - Palm Gardens', description: 'Geotechnical soil investigation',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2025-02-01', endDate: '2025-03-15',
    priority: 'high', status: 'review', dependencies: [], progress: 90, delayDays: 0,
    criticalPath: false, projectId: 'p3', towerId: 't6', floorId: 'f19', phase: 'Pre-Construction',
    checklist: [
      { id: 'c53', title: 'Bore holes completed', completed: true },
      { id: 'c54', title: 'Lab testing done', completed: true },
      { id: 'c55', title: 'Report generated', completed: false },
    ],
    comments: [],
  },
  // More delayed tasks
  {
    id: 'task24', title: 'Lift Shaft Construction - Tower A', description: 'Lift shaft construction Floors 1-12',
    department: 'Civil', assignedHOD: 'u3', assignedUsers: ['u6'],
    startDate: '2024-10-01', endDate: '2025-02-28',
    priority: 'critical', status: 'delayed', dependencies: ['task4'], progress: 45, delayDays: 18,
    delayReason: 'Formwork material delay from supplier', criticalPath: true, projectId: 'p1', towerId: 't1', floorId: 'f1', phase: 'Structure',
    checklist: [], comments: [{ user: 'Amit Patel', text: 'Escalated to vendor management', date: '2025-02-20' }],
  },
  {
    id: 'task25', title: 'External Plastering - Tower A', description: 'External wall plastering Floors 1-5',
    department: 'Finishing', assignedHOD: 'u9', assignedUsers: ['u12'],
    startDate: '2025-02-15', endDate: '2025-05-30',
    priority: 'medium', status: 'delayed', dependencies: ['task8'], progress: 10, delayDays: 8,
    delayReason: 'Scaffolding availability', criticalPath: false, projectId: 'p1', towerId: 't1', floorId: 'f3', phase: 'Finishing',
    checklist: [], comments: [],
  },
];

// Shift all task dates +2 years
export const tasks = rawTasks.map(task => ({
  ...task,
  startDate: shiftDate(task.startDate),
  endDate: shiftDate(task.endDate),
  actualStartDate: task.actualStartDate ? shiftDate(task.actualStartDate) : undefined,
  actualEndDate: task.actualEndDate ? shiftDate(task.actualEndDate) : undefined,
  // shift dates inside comments if needed (not necessary for timeline)
  // We don't shift the comment dates, as they are only textual.
}));

// ===== HURDLES (optional – shift dates if you wish) =====
const rawHurdles: Hurdle[] = [
  {
    id: 'h1', title: 'Cement Shortage', description: 'OPC 53 grade cement supply disrupted due to factory shutdown',
    type: 'material_delay', affectedTaskId: 'task8', affectedTower: 'Tower A', responsibleDepartment: 'Civil',
    impactDays: 7, severity: 'high', status: 'in_progress', projectId: 'p1', reportedDate: '2025-02-28',
  },
  {
    id: 'h2', title: 'Electrical Panel Delivery Delayed', description: 'Main distribution board delayed by manufacturer',
    type: 'vendor_delay', affectedTaskId: 'task9', affectedTower: 'Tower A', responsibleDepartment: 'Electrical',
    impactDays: 14, severity: 'critical', status: 'escalated', projectId: 'p1', reportedDate: '2025-02-15',
  },
  {
    id: 'h3', title: 'Labour Strike', description: 'Partial work stoppage by masonry workers demanding pay revision',
    type: 'labour_shortage', affectedTaskId: 'task14', affectedTower: 'Tower A', responsibleDepartment: 'Finishing',
    impactDays: 5, severity: 'high', status: 'resolved', resolutionNotes: 'Negotiated 8% pay increase', projectId: 'p1', reportedDate: '2025-02-10', resolvedDate: '2025-02-18',
  },
  {
    id: 'h4', title: 'Fire NOC Approval Pending', description: 'Fire department approval for Tower A design pending since 3 weeks',
    type: 'approval_pending', affectedTaskId: 'task15', affectedTower: 'Tower A', responsibleDepartment: 'Fire Safety',
    impactDays: 21, severity: 'critical', status: 'open', projectId: 'p1', reportedDate: '2025-02-01',
  },
  {
    id: 'h5', title: 'Design Revision - Lobby Area', description: 'Architect requested design change for ground floor lobby',
    type: 'design_change', affectedTaskId: 'task14', affectedTower: 'Tower A', responsibleDepartment: 'Finishing',
    impactDays: 10, severity: 'medium', status: 'in_progress', projectId: 'p1', reportedDate: '2025-03-01',
  },
  {
    id: 'h6', title: 'Crane Breakdown', description: 'Tower crane hydraulic system failure, needs replacement parts',
    type: 'equipment_failure', affectedTaskId: 'task17', affectedTower: 'Tower B', responsibleDepartment: 'Civil',
    impactDays: 4, severity: 'high', status: 'resolved', resolutionNotes: 'Spare parts sourced from alternate vendor',
    projectId: 'p1', reportedDate: '2025-01-20', resolvedDate: '2025-01-25',
  },
  {
    id: 'h7', title: 'Heavy Rainfall Warning', description: 'IMD yellow alert for next 5 days, external work suspended',
    type: 'weather_delay', affectedTaskId: 'task20', affectedTower: 'Tower A', responsibleDepartment: 'Civil',
    impactDays: 5, severity: 'medium', status: 'open', projectId: 'p2', reportedDate: '2025-03-08',
  },
  {
    id: 'h8', title: 'Formwork Material Delay', description: 'Aluminum formwork panels stuck in transit',
    type: 'material_delay', affectedTaskId: 'task24', affectedTower: 'Tower A', responsibleDepartment: 'Civil',
    impactDays: 18, severity: 'critical', status: 'escalated', projectId: 'p1', reportedDate: '2025-01-15',
  },
  {
    id: 'h9', title: 'Plumber Shortage', description: 'Insufficient skilled plumbers for parallel floor work',
    type: 'labour_shortage', affectedTaskId: 'task10', affectedTower: 'Tower A', responsibleDepartment: 'Plumbing',
    impactDays: 3, severity: 'low', status: 'resolved', resolutionNotes: 'Hired 5 additional plumbers from subcontractor',
    projectId: 'p1', reportedDate: '2025-02-20', resolvedDate: '2025-02-24',
  },
  {
    id: 'h10', title: 'Soil Contamination Found', description: 'Chemical contamination detected in bore sample #3',
    type: 'design_change', affectedTaskId: 'task23', affectedTower: 'Tower A', responsibleDepartment: 'Civil',
    impactDays: 15, severity: 'high', status: 'in_progress', projectId: 'p3', reportedDate: '2025-03-01',
  },
];

// Shift hurdle dates too (optional)
export const hurdles = rawHurdles.map(h => ({
  ...h,
  reportedDate: shiftDate(h.reportedDate),
  resolvedDate: h.resolvedDate ? shiftDate(h.resolvedDate) : undefined,
}));

// ===== CHECKLIST TEMPLATES (unchanged) =====
export const checklistTemplates: ChecklistTemplate[] = [
  { id: 'ct1', name: 'Foundation Excavation', category: 'Foundation', items: ['Site survey completed', 'Soil testing report reviewed', 'Excavation plan approved', 'Safety barriers installed', 'Dewatering system ready', 'Level marking done', 'Excavation depth verified', 'Soil disposal arranged'] },
  { id: 'ct2', name: 'RCC Foundation', category: 'Foundation', items: ['PCC laid and cured', 'Rebar placement per drawing', 'Cover blocks placed', 'Formwork aligned', 'Concrete mix design approved', 'Slump test done', 'Concrete pouring completed', 'Curing schedule initiated'] },
  { id: 'ct3', name: 'Column Casting', category: 'Structure', items: ['Column layout marked', 'Starter bars checked', 'Rebar tied per schedule', 'Formwork erected', 'Verticality checked', 'Concrete poured', 'Vibration done', 'De-shuttering after curing'] },
  { id: 'ct4', name: 'Slab Casting', category: 'Structure', items: ['Shuttering erected', 'Slab rebar placed', 'Electrical conduits embedded', 'Plumbing sleeves placed', 'Pre-pour inspection done', 'Concrete poured', 'Curing started', 'De-shuttering after 14 days'] },
  { id: 'ct5', name: 'Electrical Installation', category: 'MEP', items: ['Material delivered', 'Layout marking completed', 'Conduit installed', 'Wiring completed', 'Switch boards fixed', 'Earthing done', 'Inspection completed', 'Photos uploaded', 'QA approved'] },
  { id: 'ct6', name: 'Plumbing Installation', category: 'MEP', items: ['Material delivered', 'Layout per drawing', 'Pipe installation done', 'Joints sealed', 'Pressure test completed', 'Leak test passed', 'Insulation applied', 'Final inspection done'] },
  { id: 'ct7', name: 'Waterproofing', category: 'MEP', items: ['Surface cleaned and prepared', 'Primer coat applied', 'Membrane laid', 'Seams sealed', 'Ponding test - 48 hours', 'No leaks confirmed', 'Protection screed applied', 'Photos documented'] },
  { id: 'ct8', name: 'Fire Safety System', category: 'Fire Safety', items: ['Fire riser installed', 'Sprinkler layout approved', 'Sprinkler pipes installed', 'Alarm system installed', 'Smoke detectors placed', 'Hydrant system ready', 'Pressure test done', 'Fire department inspection', 'NOC obtained'] },
  { id: 'ct9', name: 'Lift Installation', category: 'MEP', items: ['Lift shaft dimensions verified', 'Guide rails installed', 'Machine room prepared', 'Control panel installed', 'Cabin assembled', 'Safety switches tested', 'Load test completed', 'Lift certification received'] },
  { id: 'ct10', name: 'Internal Plastering', category: 'Finishing', items: ['Wall surface prepared', 'Plumb line checked', 'Chicken mesh at junctions', 'First coat applied', 'Curing done', 'Second coat applied', 'Surface finish verified', 'Thickness checked'] },
  { id: 'ct11', name: 'Painting', category: 'Finishing', items: ['Surface sanded', 'Primer coat applied', 'Putty applied', 'Sanding after putty', 'First paint coat', 'Second paint coat', 'Touch-up done', 'Final inspection'] },
  { id: 'ct12', name: 'Tiling', category: 'Finishing', items: ['Surface leveled', 'Layout pattern approved', 'Adhesive applied', 'Tiles laid', 'Spacing verified', 'Grouting done', 'Cleaning completed', 'Edge finishing done'] },
  { id: 'ct13', name: 'RERA Registration', category: 'Legal', items: ['Project documents compiled', 'Land title verified', 'Architect certificate obtained', 'Engineer certificate obtained', 'CA certificate obtained', 'Application form filled', 'Fees paid', 'Registration number received'] },
  { id: 'ct14', name: 'Occupancy Certificate', category: 'Legal', items: ['Building completion certificate', 'Fire NOC obtained', 'Lift certification done', 'Water supply connection', 'Sewage connection', 'Electrical supply certificate', 'Structural stability certificate', 'OC application submitted', 'OC received'] },
  { id: 'ct15', name: 'Customer Handover', category: 'Handover', items: ['Final cleaning done', 'Snagging list cleared', 'All keys handed', 'Meter readings recorded', 'Welcome kit provided', 'Parking allotment done', 'Documentation handed', 'Customer signed off'] },
  { id: 'ct16', name: 'Society Formation', category: 'Society', items: ['Conveyance deed prepared', 'Society registration application', 'First AGM conducted', 'Committee elected', 'Bank account opened', 'Common area handed over', 'Maintenance agreement signed', 'Developer responsibilities transferred'] },
  { id: 'ct17', name: 'External Plastering', category: 'Finishing', items: ['Scaffolding erected', 'Wall cleaned', 'Chicken mesh applied', 'First coat plaster', 'Curing', 'Second coat', 'Texture finish', 'Scaffolding removed'] },
  { id: 'ct18', name: 'Window Installation', category: 'Finishing', items: ['Frame dimensions verified', 'Frames received and inspected', 'Frame fixing done', 'Glass panels installed', 'Sealant applied', 'Hardware fitted', 'Water test done', 'Cleaning done'] },
  { id: 'ct19', name: 'Snagging Checklist', category: 'Handover', items: ['Paint defects checked', 'Tile alignment verified', 'Plumbing leaks checked', 'Electrical points tested', 'Door/window operation verified', 'Waterproofing verified', 'Flooring level checked', 'All fixtures working'] },
  { id: 'ct20', name: 'Site Mobilization', category: 'Foundation', items: ['Site office setup', 'Labour camp ready', 'Material storage area', 'Water supply arranged', 'Power supply connected', 'Safety equipment procured', 'First aid station', 'Site signage installed'] },
];

// ===== RESOURCES (unchanged) =====
export const resources: Resource[] = [
  { taskId: 'task4', labour: 25, machines: [{ name: 'Concrete Pump', qty: 2 }, { name: 'Vibrator', qty: 4 }], materials: [{ name: 'Cement', qty: 100, unit: 'bags' }, { name: 'Steel', qty: 5, unit: 'tons' }, { name: 'Sand', qty: 20, unit: 'cum' }], vendor: 'ABC Contractors' },
  { taskId: 'task8', labour: 30, machines: [{ name: 'Concrete Pump', qty: 2 }, { name: 'Tower Crane', qty: 1 }], materials: [{ name: 'Cement', qty: 150, unit: 'bags' }, { name: 'Steel', qty: 8, unit: 'tons' }], vendor: 'ABC Contractors' },
  { taskId: 'task10', labour: 6, machines: [], materials: [{ name: 'CPVC Pipes', qty: 200, unit: 'meters' }, { name: 'Fittings', qty: 50, unit: 'pieces' }], vendor: 'Jain Plumbing' },
  { taskId: 'task14', labour: 15, machines: [{ name: 'Mixer', qty: 2 }], materials: [{ name: 'Cement', qty: 60, unit: 'bags' }, { name: 'Sand', qty: 15, unit: 'cum' }] },
];

// ===== HELPER FUNCTIONS (unchanged) =====
export function getTasksByProject(projectId: string) { return tasks.filter(t => t.projectId === projectId); }
export function getTasksByTower(towerId: string) { return tasks.filter(t => t.towerId === towerId); }
export function getTasksByFloor(floorId: string) { return tasks.filter(t => t.floorId === floorId); }
export function getTasksByStatus(status: TaskStatus) { return tasks.filter(t => t.status === status); }
export function getTowersByProject(projectId: string) { return towers.filter(t => t.projectId === projectId); }
export function getFloorsByTower(towerId: string) { return floors.filter(f => f.towerId === towerId); }
export function getUnitsByFloor(floorId: string) { return units.filter(u => u.floorId === floorId); }
export function getHurdlesByProject(projectId: string) { return hurdles.filter(h => h.projectId === projectId); }
export function getUserById(id: string) { return users.find(u => u.id === id); }
export function getProjectById(id: string) { return projects.find(p => p.id === id); }
export function getTowerById(id: string) { return towers.find(t => t.id === id); }

export const statusColors: Record<TaskStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  ready: 'bg-info/10 text-info',
  in_progress: 'bg-warning/10 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
  review: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  delayed: 'bg-destructive/10 text-destructive',
};

export const statusLabels: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  ready: 'Ready',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  review: 'Review',
  completed: 'Completed',
  delayed: 'Delayed',
};

export const priorityColors: Record<Priority, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning text-warning-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};

export const hurdleSeverityColors: Record<HurdleSeverity, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning text-warning-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};

export const departmentStats = [
  { name: 'Civil', completed: 45, inProgress: 12, delayed: 3, total: 60 },
  { name: 'Electrical', completed: 18, inProgress: 8, delayed: 2, total: 28 },
  { name: 'Plumbing', completed: 15, inProgress: 6, delayed: 1, total: 22 },
  { name: 'Finishing', completed: 8, inProgress: 10, delayed: 2, total: 20 },
  { name: 'Fire Safety', completed: 5, inProgress: 3, delayed: 1, total: 9 },
  { name: 'MEP', completed: 12, inProgress: 5, delayed: 2, total: 19 },
];