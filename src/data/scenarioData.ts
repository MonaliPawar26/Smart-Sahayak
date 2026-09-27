/**
 * Scenario Data Layer for PS 26123
 * Edge-AI Based Distributed Fleet Coordination for AMRs in Smart Warehouses
 * Bharat Electronics Limited (BEL)
 */

export interface ScenarioDefinition {
  scenario_id: string;
  name: string;
  description: string;
  robot_count: number;
  task_count: number;
}

export interface ScenarioRobotData {
  robot_id: string;
  scenario_id: string;
  position: { x: number; y: number };
  battery: number;
  status: 'idle' | 'assigned' | 'moving' | 'waiting' | 'blocked' | 'replanning' | 'completed' | 'failed' | 'charging';
  current_task: string | null;
  speed: number;
  name?: string;
  color?: string;
}

export interface ScenarioTaskData {
  task_id: string;
  scenario_id: string;
  pickup: { x: number; y: number };
  destination: { x: number; y: number };
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  status: 'pending' | 'auctioning' | 'assigned' | 'in_progress' | 'blocked' | 'reassigned' | 'completed';
  assigned_robot: string | null;
}

export interface ScenarioEventData {
  scenario_id: string;
  step: number;
  triggerTime: number; // seconds
  event_type: 'blocked_aisle' | 'robot_failure' | 'network_degradation' | 'dynamic_obstacle' | 'task_arrival';
  location?: string;
  gridCoord?: { x: number; y: number };
  source_robot?: string;
  duration?: number;
}

export interface MeasuredScenarioMetrics {
  scenario_id: string;
  approach: 'proposed_decentralized' | 'traditional_stop_and_wait';
  completion_time_steps: number;
  makespan_sec: number;
  tasks_completed: number;
  inter_robot_collisions: number;
  deadlocks: number;
  conflicts_detected: number;
  replans: number;
  task_reassignments: number;
  avg_waiting_time_sec: number;
  planning_time_ms: number;
  communication_delay_ms: number;
}

// ============================================================================
// 1. SCENARIOS DEFINITIONS (S01 - S08)
// ============================================================================
export const SCENARIOS: ScenarioDefinition[] = [
  {
    scenario_id: 'S01',
    name: 'S01 — Normal Warehouse',
    description: '3 AMRs operating under normal traffic conditions without blocked aisles or network drops.',
    robot_count: 3,
    task_count: 3,
  },
  {
    scenario_id: 'S02',
    name: 'S02 — Overlapping Paths',
    description: '3 AMRs with crossing trajectories across central expressways; multiple potential intersection conflicts.',
    robot_count: 3,
    task_count: 3,
  },
  {
    scenario_id: 'S03',
    name: 'S03 — Chokepoint',
    description: '4 AMRs competing for a narrow 1-lane central aisle corridor; tests space-time reservations & priority auctioning.',
    robot_count: 4,
    task_count: 4,
  },
  {
    scenario_id: 'S04',
    name: 'S04 — Blocked Aisle',
    description: '4 AMRs with a sudden aisle blockage at step 70 (T=15s); triggers BLOCK_REPORT, local replanning & task re-auction.',
    robot_count: 4,
    task_count: 4,
  },
  {
    scenario_id: 'S05',
    name: 'S05 — Multiple Blockages',
    description: '5 AMRs facing two sequential aisle blockages at T=12s and T=25s, requiring multiple replanning events & re-auctions.',
    robot_count: 5,
    task_count: 5,
  },
  {
    scenario_id: 'S06',
    name: 'S06 — Robot Failure',
    description: '4 AMRs where AMR-03 suffers a hardware failure at T=15s; its active task is automatically released and reallocated.',
    robot_count: 4,
    task_count: 4,
  },
  {
    scenario_id: 'S07',
    name: 'S07 — Network Degradation',
    description: '4 AMRs experiencing simulated Wi-Fi RF shadow / network blackout at T=15s; demonstrates local sensing safety fallback.',
    robot_count: 4,
    task_count: 4,
  },
  {
    scenario_id: 'S08',
    name: 'S08 — High Traffic',
    description: '6 AMRs with 8 high-density concurrent tasks stress-testing fleet coordination and throughput capacity.',
    robot_count: 6,
    task_count: 8,
  },
];

// ============================================================================
// 2. ROBOT DATASETS PER SCENARIO
// ============================================================================
export const ROBOT_DATASETS: Record<string, ScenarioRobotData[]> = {
  S01: [
    { robot_id: 'AMR01', scenario_id: 'S01', position: { x: 2, y: 2 }, battery: 95, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S01', position: { x: 45, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S01', position: { x: 2, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
  ],
  S02: [
    { robot_id: 'AMR01', scenario_id: 'S02', position: { x: 2, y: 13 }, battery: 92, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S02', position: { x: 45, y: 13 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S02', position: { x: 23, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
  ],
  S03: [
    { robot_id: 'AMR01', scenario_id: 'S03', position: { x: 2, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S03', position: { x: 45, y: 2 }, battery: 85, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S03', position: { x: 2, y: 25 }, battery: 87, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S03', position: { x: 45, y: 25 }, battery: 92, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
  ],
  S04: [
    { robot_id: 'AMR01', scenario_id: 'S04', position: { x: 2, y: 2 }, battery: 95, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S04', position: { x: 45, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S04', position: { x: 2, y: 25 }, battery: 85, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S04', position: { x: 45, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
  ],
  S05: [
    { robot_id: 'AMR01', scenario_id: 'S05', position: { x: 2, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S05', position: { x: 45, y: 2 }, battery: 92, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S05', position: { x: 2, y: 25 }, battery: 85, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S05', position: { x: 45, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
    { robot_id: 'AMR05', scenario_id: 'S05', position: { x: 23, y: 2 }, battery: 94, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-05 (Zephyr)', color: '#EC4899' },
  ],
  S06: [
    { robot_id: 'AMR01', scenario_id: 'S06', position: { x: 2, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S06', position: { x: 45, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S06', position: { x: 2, y: 25 }, battery: 85, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S06', position: { x: 45, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
  ],
  S07: [
    { robot_id: 'AMR01', scenario_id: 'S07', position: { x: 2, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S07', position: { x: 45, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S07', position: { x: 2, y: 25 }, battery: 85, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S07', position: { x: 45, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
  ],
  S08: [
    { robot_id: 'AMR01', scenario_id: 'S08', position: { x: 2, y: 2 }, battery: 95, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-01 (Titan)', color: '#3B82F6' },
    { robot_id: 'AMR02', scenario_id: 'S08', position: { x: 45, y: 2 }, battery: 90, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-02 (Aegis)', color: '#10B981' },
    { robot_id: 'AMR03', scenario_id: 'S08', position: { x: 2, y: 25 }, battery: 88, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-03 (Atlas)', color: '#F59E0B' },
    { robot_id: 'AMR04', scenario_id: 'S08', position: { x: 45, y: 25 }, battery: 92, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
    { robot_id: 'AMR05', scenario_id: 'S08', position: { x: 23, y: 2 }, battery: 91, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-05 (Zephyr)', color: '#EC4899' },
    { robot_id: 'AMR06', scenario_id: 'S08', position: { x: 23, y: 25 }, battery: 89, status: 'idle', current_task: null, speed: 1.0, name: 'AMR-06 (Orion)', color: '#06B6D4' },
  ],
};

// ============================================================================
// 3. TASK DATASETS PER SCENARIO
// ============================================================================
export const TASK_DATASETS: Record<string, ScenarioTaskData[]> = {
  S01: [
    { task_id: 'T01', scenario_id: 'S01', pickup: { x: 4, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S01', pickup: { x: 16, y: 1 }, destination: { x: 30, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S01', pickup: { x: 28, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S02: [
    { task_id: 'T01', scenario_id: 'S02', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S02', pickup: { x: 32, y: 1 }, destination: { x: 10, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S02', pickup: { x: 16, y: 1 }, destination: { x: 46, y: 20 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S03: [
    { task_id: 'T01', scenario_id: 'S03', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Critical', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S03', pickup: { x: 32, y: 1 }, destination: { x: 10, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S03', pickup: { x: 12, y: 1 }, destination: { x: 30, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S03', pickup: { x: 28, y: 1 }, destination: { x: 18, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S04: [
    { task_id: 'T01', scenario_id: 'S04', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Critical', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S04', pickup: { x: 8, y: 1 }, destination: { x: 30, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S04', pickup: { x: 16, y: 1 }, destination: { x: 18, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S04', pickup: { x: 28, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S05: [
    { task_id: 'T01', scenario_id: 'S05', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S05', pickup: { x: 12, y: 1 }, destination: { x: 30, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S05', pickup: { x: 16, y: 1 }, destination: { x: 18, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S05', pickup: { x: 28, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T05', scenario_id: 'S05', pickup: { x: 32, y: 1 }, destination: { x: 46, y: 20 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S06: [
    { task_id: 'T01', scenario_id: 'S06', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Critical', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S06', pickup: { x: 12, y: 1 }, destination: { x: 30, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S06', pickup: { x: 16, y: 1 }, destination: { x: 18, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S06', pickup: { x: 28, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S07: [
    { task_id: 'T01', scenario_id: 'S07', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S07', pickup: { x: 12, y: 1 }, destination: { x: 30, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S07', pickup: { x: 16, y: 1 }, destination: { x: 18, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S07', pickup: { x: 28, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
  S08: [
    { task_id: 'T01', scenario_id: 'S08', pickup: { x: 4, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Critical', status: 'pending', assigned_robot: null },
    { task_id: 'T02', scenario_id: 'S08', pickup: { x: 8, y: 1 }, destination: { x: 30, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T03', scenario_id: 'S08', pickup: { x: 12, y: 1 }, destination: { x: 18, y: 26 }, priority: 'High', status: 'pending', assigned_robot: null },
    { task_id: 'T04', scenario_id: 'S08', pickup: { x: 16, y: 1 }, destination: { x: 10, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T05', scenario_id: 'S08', pickup: { x: 28, y: 1 }, destination: { x: 46, y: 8 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T06', scenario_id: 'S08', pickup: { x: 32, y: 1 }, destination: { x: 46, y: 20 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T07', scenario_id: 'S08', pickup: { x: 4, y: 1 }, destination: { x: 30, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
    { task_id: 'T08', scenario_id: 'S08', pickup: { x: 16, y: 1 }, destination: { x: 38, y: 26 }, priority: 'Normal', status: 'pending', assigned_robot: null },
  ],
};

// ============================================================================
// 4. DYNAMIC EVENT DATASETS PER SCENARIO
// ============================================================================
export const EVENT_DATASETS: Record<string, ScenarioEventData[]> = {
  S01: [],
  S02: [],
  S03: [],
  S04: [
    {
      scenario_id: 'S04',
      step: 70,
      triggerTime: 15.0,
      event_type: 'blocked_aisle',
      location: 'Aisle-04',
      gridCoord: { x: 23, y: 13 },
      source_robot: 'AMR02',
    },
  ],
  S05: [
    {
      scenario_id: 'S05',
      step: 60,
      triggerTime: 12.0,
      event_type: 'blocked_aisle',
      location: 'Aisle-02',
      gridCoord: { x: 12, y: 13 },
      source_robot: 'AMR01',
    },
    {
      scenario_id: 'S05',
      step: 120,
      triggerTime: 25.0,
      event_type: 'blocked_aisle',
      location: 'Aisle-05',
      gridCoord: { x: 34, y: 13 },
      source_robot: 'AMR03',
    },
  ],
  S06: [
    {
      scenario_id: 'S06',
      step: 75,
      triggerTime: 15.0,
      event_type: 'robot_failure',
      source_robot: 'AMR03',
    },
  ],
  S07: [
    {
      scenario_id: 'S07',
      step: 75,
      triggerTime: 15.0,
      event_type: 'network_degradation',
      duration: 20.0,
    },
  ],
  S08: [],
};
