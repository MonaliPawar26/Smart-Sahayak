/**
 * Edge-AI AMR Fleet Coordination Types
 * Bharat Electronics Limited (BEL)
 */

export interface Position2D {
  x: number; // Continuous warehouse coordinate (meters or grid units)
  y: number;
}

export interface GridCoord {
  x: number; // Discrete grid integer
  y: number;
}

export enum CellType {
  FLOOR = 'FLOOR',
  RACK = 'RACK',
  HIGHWAY = 'HIGHWAY',
  AISLE = 'AISLE',
  BYPASS_BAY = 'BYPASS_BAY',
  CHARGING_PAD = 'CHARGING_PAD',
  PICKUP_STATION = 'PICKUP_STATION',
  DROPOFF_DOCK = 'DROPOFF_DOCK',
  STATIC_OBSTACLE = 'STATIC_OBSTACLE',
  DYNAMIC_OBSTACLE = 'DYNAMIC_OBSTACLE',
}

export enum AMRState {
  IDLE = 'IDLE',
  BIDDING = 'BIDDING',
  MOVING_TO_PICKUP = 'MOVING_TO_PICKUP',
  LOADING = 'LOADING',
  MOVING_TO_DROPOFF = 'MOVING_TO_DROPOFF',
  UNLOADING = 'UNLOADING',
  RESOLVING_CONFLICT = 'RESOLVING_CONFLICT',
  YIELDING_PULL_IN = 'YIELDING_PULL_IN',
  STOP_WAIT = 'STOP_WAIT',
  RETURNING_TO_CHARGER = 'RETURNING_TO_CHARGER',
  CHARGING = 'CHARGING',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  OFFLINE = 'OFFLINE',
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  t: number; // Simulation timestamp in seconds
  heading: number; // Angle in radians
  speed: number; // Linear velocity m/s
}

export enum CoordinationMode {
  DECENTRALIZED_EDGE = 'DECENTRALIZED_EDGE',
  TRADITIONAL_STOP_AND_WAIT = 'TRADITIONAL_STOP_AND_WAIT',
  CENTRALIZED_CLOUD = 'CENTRALIZED_CLOUD',
}

export type P2PMessageType =
  | 'HEARTBEAT'
  | 'TRAJECTORY_INTENT'
  | 'CONFLICT_NEGOTIATION'
  | 'OBSTACLE_GOSSIP'
  | 'TASK_ANNOUNCE'
  | 'TASK_BID'
  | 'TASK_AWARD'
  | 'DEADLOCK_YIELD';

export interface BaseP2PMessage {
  id: string;
  type: P2PMessageType;
  senderId: string;
  targetId?: string; // Optional: empty = local RF broadcast
  senderPos: Position2D;
  timestamp: number;
  ttl: number; // Time to live in hops/seconds
}

export interface HeartbeatMessage extends BaseP2PMessage {
  type: 'HEARTBEAT';
  battery: number;
  speed: number;
  heading: number;
  state: AMRState;
  hasPayload: boolean;
  activeTaskId?: string;
}

export interface TrajectoryIntentMessage extends BaseP2PMessage {
  type: 'TRAJECTORY_INTENT';
  trajectory: TrajectoryPoint[];
  priorityScore: number;
  destination: Position2D;
  isUrgent: boolean;
}

export interface ConflictNegotiationMessage extends BaseP2PMessage {
  type: 'CONFLICT_NEGOTIATION';
  conflictPos: Position2D;
  conflictTime: number;
  proposedAction: 'YIELD' | 'PROCEED' | 'REVERSE_TO_BAY' | 'REROUTE';
  priorityScore: number;
  assignedBay?: Position2D;
}

export interface ObstacleGossipMessage extends BaseP2PMessage {
  type: 'OBSTACLE_GOSSIP';
  obstaclePos: GridCoord;
  isBlocked: boolean;
  detectedAt: number;
  confidence: number;
  originRobotId: string;
}

export interface TaskAnnounceMessage extends BaseP2PMessage {
  type: 'TASK_ANNOUNCE';
  task: WarehouseTask;
}

export interface TaskBidMessage extends BaseP2PMessage {
  type: 'TASK_BID';
  taskId: string;
  bidCost: number; // Lower is better
  estimatedEtaSec: number;
  batteryLevel: number;
}

export interface TaskAwardMessage extends BaseP2PMessage {
  type: 'TASK_AWARD';
  taskId: string;
  winnerRobotId: string;
}

export interface DeadlockYieldMessage extends BaseP2PMessage {
  type: 'DEADLOCK_YIELD';
  yieldingRobotId: string;
  masterRobotId: string;
  bayCoord: Position2D;
}

export type P2PMessage =
  | HeartbeatMessage
  | TrajectoryIntentMessage
  | ConflictNegotiationMessage
  | ObstacleGossipMessage
  | TaskAnnounceMessage
  | TaskBidMessage
  | TaskAwardMessage
  | DeadlockYieldMessage;

export interface WarehouseTask {
  id: string;
  sku: string;
  pickup: Position2D;
  dropoff: Position2D;
  priority: number; // 1 (normal) to 5 (critical)
  status: 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedRobotId?: string;
  createdAt: number;
  completedAt?: number;
  weightKg: number;
}

export interface EdgeHardwareMetrics {
  cpuUsagePct: number;
  ramUsageMb: number;
  planningLatencyMs: number;
  packetRatePerSec: number;
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  isInDeadZone: boolean;
  rfSignalDb: number;
}

export interface AMRTelemetry {
  id: string;
  name: string;
  color: string;
  pos: Position2D;
  heading: number;
  velocity: { vx: number; vy: number; speed: number };
  state: AMRState;
  batteryPct: number;
  isCharging: boolean;
  hasPayload: boolean;
  payloadWeightKg: number;
  currentTask?: WarehouseTask;
  plannedPath: TrajectoryPoint[];
  executedPathHistory: Position2D[];
  distanceTraveledM: number;
  tasksCompleted: number;
  edgeMetrics: EdgeHardwareMetrics;
  lastConflictResolved?: string;
  isYielding: boolean;
  yieldBayTarget?: Position2D;
  isPlatooning?: boolean;
  platoonLeaderId?: string;
  isRFJammed?: boolean;
  humanDetected?: boolean;
}

export interface DeadZoneArea {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  signalAttenuationPct: number; // 0 to 100%
  description: string;
}

export interface HumanWorker {
  id: string;
  name: string;
  type: 'HUMAN_WORKER' | 'MANUAL_FORKLIFT';
  pos: Position2D;
  heading: number;
  speed: number;
  targetPos: Position2D;
  cautionRadius: number; // e.g. 2.0m safety zone
  isYieldingToRobot?: boolean;
  yieldingForRobotId?: string;
  statusText?: string;
}

export interface RFJammerZone {
  id: string;
  pos: Position2D;
  radius: number; // meters
  intensity: number; // 0 to 1
  active: boolean;
}

export interface CollaborativeTandem {
  id: string;
  crateId: string;
  masterRobotId: string;
  followerRobotId: string;
  offsetDistance: number; // e.g. 1.2m
  weightKg: number;
  isLocked: boolean;
  status: 'FORMING' | 'LOCKED_TRANSPORT' | 'UNLOCKED';
}

export interface PlatoonGroup {
  id: string;
  leaderId: string;
  followerIds: string[];
  highwayLane: number;
}

export interface ByzantineAnomalyRecord {
  id: string;
  suspectRobotId: string;
  reason: string;
  detectedAt: number;
  mitigationAction: string;
}

export interface WarehousePresetScenario {
  id: string;
  name: string;
  description: string;
  robotCount: number;
  tasks: WarehouseTask[];
  dynamicObstacles: GridCoord[];
  deadZones: DeadZoneArea[];
  highlightIssue: string;
}

export interface ConflictRecord {
  id: string;
  timestamp: number; // Simulation timestamp seconds
  zone: string; // e.g. "Intersection I-04" or "Aisle A-02"
  robotA: string;
  robotB: string;
  winnerId: string;
  loserId: string;
  winnerPriority: number;
  loserPriority: number;
  reason: string;
  action: string;
  resolutionTimeMs: number;
  isResolved: boolean;
}

export interface DeadlockRecord {
  id: string;
  timestamp: number;
  robotIds: string[];
  zone: string;
  selectedRobotId: string;
  resolutionAction: string;
  resolutionTimeMs: number;
  isResolved: boolean;
}

export interface TaskReassignmentRecord {
  id: string;
  timestamp: number;
  taskId: string;
  originalRobotId: string;
  newRobotId?: string;
  reason: string;
  decisionTimeMs: number;
  status: 'RELEASED' | 'REASSIGNED' | 'FAILED';
}

export interface EventLogEntry {
  id: string;
  timestamp: number; // formatted string or seconds
  clockTime: string; // HH:MM:SS format
  category: 'COMMUNICATION' | 'SAFETY' | 'PLANNING' | 'TASK' | 'ROBOT' | 'BENCHMARK' | 'SYSTEM';
  title: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'SUCCESS' | 'ALERT';
  robotId?: string;
  taskId?: string;
}

export interface BenchmarkResult {
  mode: CoordinationMode;
  robotCount: number;
  tasksTotal: number;
  tasksCompleted: number;
  makespanSec: number;
  throughputPerHour: number;
  avgTaskDurationSec: number;
  collisionsDetected: number;
  deadlocksOccurred: number;
  deadlocksResolved: number;
  avgStopWaitTimeSec: number;
  totalP2PMessages: number;
  avgEdgeCpuPct: number;
  speedupVsStopAndWaitPct: number;
  reroutesCount: number;
  reassignmentsCount: number;
  avgPlanningTimeMs: number;
  timestamp: number;
}
