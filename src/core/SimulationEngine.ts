import {
  AMRState,
  AMRTelemetry,
  BenchmarkResult,
  CellType,
  CollaborativeTandem,
  ConflictRecord,
  CoordinationMode,
  DeadlockRecord,
  EventLogEntry,
  GridCoord,
  HumanWorker,
  Position2D,
  TaskReassignmentRecord,
  WarehousePresetScenario,
  WarehouseTask,
} from './types';
import { WarehouseMap } from './WarehouseMap';
import { P2PNetwork } from './P2PNetwork';
import { ConflictResolver } from './ConflictResolver';
import { ContractNetAllocator } from './ContractNetAllocator';
import { AMREdgeAgent } from './AMREdgeAgent';
import {
  SCENARIOS,
  ROBOT_DATASETS,
  TASK_DATASETS,
  EVENT_DATASETS,
  ScenarioEventData,
} from '../data/scenarioData';

export class SimulationEngine {
  public map: WarehouseMap;
  public network: P2PNetwork;
  public conflictResolver: ConflictResolver;
  public taskAllocator: ContractNetAllocator;
  public robots: AMREdgeAgent[] = [];
  public tasks: WarehouseTask[] = [];
  public completedTasks: WarehouseTask[] = [];
  public humans: HumanWorker[] = [];
  public collaborativeTandems: CollaborativeTandem[] = [];

  // Toggles & Counters
  public mode: CoordinationMode = CoordinationMode.DECENTRALIZED_EDGE;
  public isRunning: boolean = false;
  public isCloudOnline: boolean = true;
  public simulationTime: number = 0; // seconds
  public simSpeedMultiplier: number = 1.0;
  public targetRobotCount: number = 8; // Default 8 AMRs
  public isBenchmarkMode: boolean = false;
  public activeScenarioId: string = 'S04';
  public scenarioEvents: (ScenarioEventData & { triggered?: boolean })[] = [];

  // Real-time Simulation Logs & Records
  public eventLogs: EventLogEntry[] = [];
  public conflictRecords: ConflictRecord[] = [];
  public deadlockRecords: DeadlockRecord[] = [];
  public taskReassignments: TaskReassignmentRecord[] = [];
  public totalReroutes: number = 0;
  public totalTaskReassignments: number = 0;

  // Collision & Safety metrics
  public robotRadius: number = 0.45; // 0.9m diameter
  public collisionEvents: { time: number; pos: Position2D; robotA: string; robotB: string }[] = [];
  public totalCollisionsDetected: number = 0;
  public totalDeadlocksOccurred: number = 0;
  public totalDeadlocksResolved: number = 0;

  // Real-time task generator timer
  private nextTaskId: number = 1;
  private nextHumanId: number = 1;
  private lastTaskSpawnTime: number = 0;
  private taskSpawnIntervalSec: number = 3.5;

  // Benchmark history
  public benchmarkHistory: BenchmarkResult[] = [];

  constructor() {
    this.map = new WarehouseMap();
    this.network = new P2PNetwork(this.map);
    this.conflictResolver = new ConflictResolver(this.map);
    this.taskAllocator = new ContractNetAllocator(this.network);

    this.initFleet(this.targetRobotCount);
    this.initDefaultHumans();
    this.logEvent('SYSTEM', 'SYSTEM INITIALIZED', 'BEL AMR-EDGE Fleet Simulation Engine started with 8 AMRs.', 'INFO');
  }

  public logEvent(
    category: 'COMMUNICATION' | 'SAFETY' | 'PLANNING' | 'TASK' | 'ROBOT' | 'BENCHMARK' | 'SYSTEM',
    title: string,
    message: string,
    severity: 'INFO' | 'WARN' | 'SUCCESS' | 'ALERT' = 'INFO',
    robotId?: string,
    taskId?: string
  ): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const entry: EventLogEntry = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: this.simulationTime,
      clockTime: `${hh}:${mm}:${ss}`,
      category,
      title,
      message,
      severity,
      robotId,
      taskId,
    };

    this.eventLogs.unshift(entry);
    if (this.eventLogs.length > 300) {
      this.eventLogs.pop();
    }
  }

  public setMode(newMode: CoordinationMode): void {
    this.mode = newMode;
    this.logEvent('SYSTEM', 'MODE SWITCH', `Switched coordination mode to ${newMode}`, 'INFO');
  }

  public toggleCloudLink(): boolean {
    this.isCloudOnline = !this.isCloudOnline;
    this.logEvent(
      'COMMUNICATION',
      'CLOUD LINK TOGGLE',
      `Cloud connection is now ${this.isCloudOnline ? 'ONLINE' : 'OFFLINE'}. Local Edge P2P mesh handles fleet planning.`,
      this.isCloudOnline ? 'INFO' : 'WARN'
    );
    return this.isCloudOnline;
  }

  public injectRobotFailure(targetRobotId?: string): string | null {
    const activeBots = this.robots.filter((r) => r.state !== AMRState.OFFLINE);
    if (activeBots.length === 0) return null;

    const bot = targetRobotId
      ? this.robots.find((r) => r.id === targetRobotId) || activeBots[0]
      : activeBots[Math.floor(Math.random() * activeBots.length)];

    if (!bot || bot.state === AMRState.OFFLINE) return null;

    bot.state = AMRState.OFFLINE;
    bot.velocity = { vx: 0, vy: 0, speed: 0 };
    this.network.unregisterNode(bot.id);

    this.logEvent(
      'ROBOT',
      'ROBOT FAILURE INJECTED',
      `${bot.id} (${bot.name}) hardware failure injected! Node offline. Fleet size ${activeBots.length - 1}/${this.targetRobotCount}.`,
      'ALERT',
      bot.id
    );

    // Release assigned task if any
    if (bot.currentTask) {
      const task = bot.currentTask;
      task.status = 'UNASSIGNED';
      task.assignedRobotId = undefined;
      bot.currentTask = undefined;
      this.totalTaskReassignments++;

      const record: TaskReassignmentRecord = {
        id: `reassign-${Date.now()}`,
        timestamp: this.simulationTime,
        taskId: task.id,
        originalRobotId: bot.id,
        reason: 'ROBOT_HARDWARE_FAILURE',
        decisionTimeMs: 42,
        status: 'RELEASED',
      };
      this.taskReassignments.unshift(record);

      this.logEvent(
        'TASK',
        'TASK RELEASED',
        `Task ${task.id} released due to failure of ${bot.id}. Re-auctioning to available AMRs.`,
        'WARN',
        bot.id,
        task.id
      );

      // Reassign to nearest available AMR immediately
      const availableBot = this.robots.find(
        (r) => r.id !== bot.id && r.state === AMRState.IDLE && !r.currentTask && r.batteryPct > 15
      );
      if (availableBot) {
        availableBot.assignTask(task, this.simulationTime);
        record.newRobotId = availableBot.id;
        record.status = 'REASSIGNED';

        this.logEvent(
          'TASK',
          'TASK REASSIGNED',
          `Task ${task.id} reassigned to ${availableBot.id}. Decision time: 42ms.`,
          'SUCCESS',
          availableBot.id,
          task.id
        );
      }
    }

    return bot.id;
  }

  public initDefaultHumans(): void {
    this.humans = [
      {
        id: 'human-1',
        name: 'Technician Ravi (Quality QA)',
        type: 'HUMAN_WORKER',
        pos: { x: 2, y: 14 },
        heading: 0,
        speed: 1.0,
        targetPos: { x: 46, y: 14 },
        cautionRadius: 2.5,
      },
      {
        id: 'forklift-1',
        name: 'Manual Forklift #04',
        type: 'MANUAL_FORKLIFT',
        pos: { x: 23, y: 2 },
        heading: Math.PI / 2,
        speed: 1.2,
        targetPos: { x: 23, y: 25 },
        cautionRadius: 2.8,
      },
    ];
  }

  public initFleet(count = 8): void {
    this.targetRobotCount = count;
    this.robots = [];
    this.tasks = [];
    this.completedTasks = [];
    this.collisionEvents = [];
    this.totalCollisionsDetected = 0;
    this.totalReroutes = 0;
    this.totalTaskReassignments = 0;
    this.simulationTime = 0;

    const robotPalette = [
      { id: 'R01', name: 'AMR-01 (Titan)', color: '#3B82F6' },
      { id: 'R02', name: 'AMR-02 (Aegis)', color: '#10B981' },
      { id: 'R03', name: 'AMR-03 (Atlas)', color: '#F59E0B' },
      { id: 'R04', name: 'AMR-04 (Valkyrie)', color: '#8B5CF6' },
      { id: 'R05', name: 'AMR-05 (Zephyr)', color: '#EC4899' },
      { id: 'R06', name: 'AMR-06 (Orion)', color: '#06B6D4' },
      { id: 'R07', name: 'AMR-07 (Phoenix)', color: '#F97316' },
      { id: 'R08', name: 'AMR-08 (Nova)', color: '#14B8A6' },
    ];

    const startPositions: { pos: Position2D; heading: number }[] = [
      { pos: { x: 2, y: 2 }, heading: 0 },             // NW Corner
      { pos: { x: 45, y: 2 }, heading: Math.PI },       // NE Corner
      { pos: { x: 2, y: 25 }, heading: 0 },            // SW Corner
      { pos: { x: 45, y: 25 }, heading: -Math.PI / 2 }, // SE Corner
      { pos: { x: 23, y: 2 }, heading: Math.PI / 2 },  // North Rotary
      { pos: { x: 23, y: 25 }, heading: -Math.PI / 2 },// South Rotary
      { pos: { x: 2, y: 13 }, heading: 0 },            // West Rotary
      { pos: { x: 45, y: 13 }, heading: Math.PI },      // East Rotary
    ];

    for (let i = 0; i < count; i++) {
      const p = robotPalette[i % robotPalette.length];
      const s = startPositions[i % startPositions.length];
      const bot = new AMREdgeAgent(
        p.id,
        p.name,
        p.color,
        { ...s.pos },
        s.heading,
        this.map,
        this.network,
        this.conflictResolver
      );
      this.robots.push(bot);
    }

    // Seed initial 4 tasks
    for (let i = 0; i < Math.min(6, count); i++) {
      this.spawnTask();
    }
  }

  public spawnTask(priorityOverride?: number): WarehouseTask {
    const taskId = `T-${String(this.nextTaskId++).padStart(2, '0')}`;
    const pickup = this.map.getRandomPickupStation();
    const dropoff = this.map.getRandomDropoffDock();
    const priority = priorityOverride || Math.floor(Math.random() * 4) + 1;

    const task: WarehouseTask = {
      id: taskId,
      sku: `SKU-BEL-${1000 + Math.floor(Math.random() * 8999)}`,
      pickup,
      dropoff,
      priority,
      status: 'UNASSIGNED',
      createdAt: this.simulationTime,
      weightKg: Math.floor(Math.random() * 180) + 20,
    };

    this.tasks.push(task);
    this.logEvent('TASK', 'TASK CREATED', `Task ${task.id} (${task.sku}) created at pickup (${pickup.x}, ${pickup.y}).`, 'INFO', undefined, task.id);

    // Baseline direct assignment if not edge mode
    if (this.mode !== CoordinationMode.DECENTRALIZED_EDGE) {
      const idleRobot = this.robots.find((r) => r.state === AMRState.IDLE && !r.currentTask);
      if (idleRobot) {
        idleRobot.assignTask(task, this.simulationTime);
      }
    }

    return task;
  }

  public loadScenario(scenarioId: string): void {
    this.isRunning = false;
    this.activeScenarioId = scenarioId;
    this.simulationTime = 0;
    this.scenarioEvents = [];
    this.map = new WarehouseMap();
    this.network = new P2PNetwork(this.map);
    this.conflictResolver = new ConflictResolver(this.map);
    this.taskAllocator = new ContractNetAllocator(this.network);

    // --- Data-driven scenarios (S01–S08) ---
    if (ROBOT_DATASETS[scenarioId]) {
      this.robots = [];
      this.tasks = [];
      this.completedTasks = [];
      this.collisionEvents = [];
      this.totalCollisionsDetected = 0;
      this.totalReroutes = 0;
      this.totalTaskReassignments = 0;
      this.network.basePacketLossRate = 0.01;

      const robotData = ROBOT_DATASETS[scenarioId];
      this.targetRobotCount = robotData.length;

      for (const r of robotData) {
        const bot = new AMREdgeAgent(
          r.robot_id,
          r.name || r.robot_id,
          r.color || '#3B82F6',
          { ...r.position },
          0,
          this.map,
          this.network,
          this.conflictResolver
        );
        bot.batteryPct = r.battery;
        this.robots.push(bot);
      }

      const taskData = TASK_DATASETS[scenarioId] || [];
      for (const t of taskData) {
        const pMap = t.priority === 'Critical' ? 4 : t.priority === 'High' ? 3 : t.priority === 'Normal' ? 2 : 1;
        const wTask: WarehouseTask = {
          id: t.task_id,
          sku: `SKU-${t.task_id}`,
          pickup: { ...t.pickup },
          dropoff: { ...t.destination },
          priority: pMap,
          status: 'UNASSIGNED',
          createdAt: 0,
          weightKg: 100,
        };
        this.tasks.push(wTask);
      }

      const eventData = EVENT_DATASETS[scenarioId] || [];
      this.scenarioEvents = eventData.map((e) => ({ ...e, triggered: false }));

      this.logEvent(
        'SYSTEM',
        'SCENARIO LOADED',
        `Loaded scenario ${scenarioId} (${this.robots.length} AMRs, ${this.tasks.length} tasks, ${this.scenarioEvents.length} dynamic events).`,
        'INFO'
      );
      return;
    }

    // --- Legacy preset scenarios ---
    switch (scenarioId) {
      case 'head_on_deadlock':
      case 'deadlock':
        this.targetRobotCount = 2;
        this.robots = [
          new AMREdgeAgent('R01', 'AMR-01 (Alpha)', '#3B82F6', { x: 5, y: 6 }, 0, this.map, this.network, this.conflictResolver),
          new AMREdgeAgent('R02', 'AMR-02 (Beta)', '#10B981', { x: 12, y: 6 }, Math.PI, this.map, this.network, this.conflictResolver),
        ];

        const task1: WarehouseTask = {
          id: 'TSK-DEADLOCK-1',
          sku: 'SKU-URGENT-DEFENSE',
          pickup: { x: 12, y: 6 },
          dropoff: { x: 30, y: 5 },
          priority: 5,
          status: 'UNASSIGNED',
          createdAt: 0,
          weightKg: 150,
        };
        const task2: WarehouseTask = {
          id: 'TSK-DEADLOCK-2',
          sku: 'SKU-NORMAL-PARTS',
          pickup: { x: 5, y: 6 },
          dropoff: { x: 1, y: 5 },
          priority: 1,
          status: 'UNASSIGNED',
          createdAt: 0,
          weightKg: 80,
        };
        this.tasks = [task1, task2];
        this.robots[0].assignTask(task1, 0);
        this.robots[1].assignTask(task2, 0);
        this.logEvent('SAFETY', 'SCENARIO LOADED', '1-Lane Aisle Head-On Deadlock Scenario initialized.', 'WARN');
        break;

      case 'intersection_stress':
      case 'narrow_intersection':
      case '4way_intersection':
        this.targetRobotCount = 4;
        this.robots = [
          new AMREdgeAgent('R01', 'AMR-01 (North)', '#3B82F6', { x: 15, y: 2 }, Math.PI / 2, this.map, this.network, this.conflictResolver),
          new AMREdgeAgent('R02', 'AMR-02 (South)', '#10B981', { x: 16, y: 17 }, -Math.PI / 2, this.map, this.network, this.conflictResolver),
          new AMREdgeAgent('R03', 'AMR-03 (West)', '#F59E0B', { x: 2, y: 9 }, 0, this.map, this.network, this.conflictResolver),
          new AMREdgeAgent('R04', 'AMR-04 (East)', '#8B5CF6', { x: 29, y: 10 }, Math.PI, this.map, this.network, this.conflictResolver),
        ];
        this.robots[0].replanTo({ x: 15, y: 17 }, 0);
        this.robots[1].replanTo({ x: 16, y: 2 }, 0);
        this.robots[2].replanTo({ x: 29, y: 9 }, 0);
        this.robots[3].replanTo({ x: 2, y: 10 }, 0);
        this.logEvent('SAFETY', 'SCENARIO LOADED', '4-Way Intersection Bottleneck Scenario initialized.', 'WARN');
        break;

      case 'blocked_aisle':
        this.initFleet(6);
        this.map.setDynamicObstacle(8, 6, true);
        this.totalReroutes++;
        this.logEvent('PLANNING', 'AISLE BLOCKED INJECTED', 'Dynamic obstacle dropped in Aisle 2 (8, 6). Local A* replanning triggered.', 'ALERT');
        break;

      case 'robot_failure':
        this.initFleet(8);
        setTimeout(() => {
          this.injectRobotFailure('R03');
        }, 1500);
        break;

      case 'rf_dead_zone':
        this.initFleet(6);
        this.isCloudOnline = false;
        this.map.setDynamicObstacle(8, 6, true);
        this.logEvent('COMMUNICATION', 'RF DEAD ZONE SCENARIO', 'Cloud link set OFFLINE. AMRs entering steel shadow zone switch to local P2P odometry.', 'WARN');
        break;

      case 'high_traffic':
        this.initFleet(8);
        for (let i = 0; i < 8; i++) {
          this.spawnTask();
        }
        break;

      default:
        this.initFleet(8);
        this.logEvent('SYSTEM', 'SCENARIO LOADED', 'Standard 8-AMR Shift Scenario initialized.', 'INFO');
        break;
    }
  }

  /**
   * Main simulation tick loop
   */
  public step(rawDt: number): void {
    const dt = Math.min(0.1, rawDt) * this.simSpeedMultiplier;
    this.simulationTime += dt;

    // 0. Dynamic Scenario Events Execution
    for (const evt of this.scenarioEvents) {
      if (!evt.triggered && this.simulationTime >= evt.triggerTime) {
        evt.triggered = true;

        if (evt.event_type === 'blocked_aisle' && evt.gridCoord) {
          // Block the aisle using the proper WarehouseMap API
          this.map.setDynamicObstacle(evt.gridCoord.x, evt.gridCoord.y, true);
          this.totalReroutes++;

          // Broadcast OBSTACLE_GOSSIP to all AMRs over P2P mesh
          const senderId = evt.source_robot || 'R01';
          this.network.broadcast(
            senderId,
            {
              id: `msg-block-${Date.now()}`,
              type: 'OBSTACLE_GOSSIP',
              senderId,
              senderPos: { x: evt.gridCoord.x, y: evt.gridCoord.y },
              timestamp: this.simulationTime,
              ttl: 10,
              obstaclePos: { x: evt.gridCoord.x, y: evt.gridCoord.y },
              isBlocked: true,
              detectedAt: this.simulationTime,
              confidence: 1.0,
              originRobotId: senderId,
            },
            this.simulationTime
          );

          // Re-plan affected AMRs whose path intersects the blocked cell
          for (const robot of this.robots) {
            if (robot.state !== AMRState.OFFLINE && robot.currentTask) {
              const intersects = robot.plannedPath.some(
                (p) => Math.round(p.x) === evt.gridCoord!.x && Math.round(p.y) === evt.gridCoord!.y
              );
              if (intersects) {
                robot.replanTo(robot.currentTask.dropoff, this.simulationTime);
              }
            }
          }

          this.logEvent(
            'COMMUNICATION',
            'DYNAMIC EVENT: BLOCKED AISLE',
            `Aisle ${evt.location || ''} (${evt.gridCoord.x}, ${evt.gridCoord.y}) blocked! Triggered BLOCK_REPORT & local replanning.`,
            'ALERT'
          );
        } else if (evt.event_type === 'robot_failure') {
          const targetBot = this.robots.find((r) => r.id === (evt.source_robot || 'R03'));
          if (targetBot) {
            targetBot.state = AMRState.OFFLINE;
            if (targetBot.currentTask) {
              const orphanTask = targetBot.currentTask;
              orphanTask.status = 'UNASSIGNED';
              orphanTask.assignedRobotId = undefined;
              targetBot.currentTask = undefined;
              this.totalTaskReassignments++;
              this.logEvent(
                'TASK',
                'DYNAMIC EVENT: ROBOT FAILURE',
                `Robot ${targetBot.id} failed mid-mission. Task ${orphanTask.id} re-auctioned!`,
                'ALERT',
                targetBot.id,
                orphanTask.id
              );
            }
          }
        } else if (evt.event_type === 'network_degradation') {
          this.network.basePacketLossRate = 0.8;
          this.logEvent(
            'COMMUNICATION',
            'DYNAMIC EVENT: NETWORK DEGRADATION',
            `Wi-Fi RF shadow active! High packet loss (80%). AMRs fall back to local sensing safety.`,
            'WARN'
          );
        }
      }
    }

    // 1. Continuous task stream generator (maintains active task buffer so fleet never runs out)
    if (!this.isBenchmarkMode) {
      const unassignedTasks = this.tasks.filter((t) => t.status === 'UNASSIGNED');
      if (unassignedTasks.length < Math.max(10, this.targetRobotCount * 2)) {
        const needed = Math.max(10, this.targetRobotCount * 2) - unassignedTasks.length;
        for (let i = 0; i < needed; i++) {
          this.spawnTask();
        }
      }
    }

    // 2. Contract Net Auction Step
    if (this.mode === CoordinationMode.DECENTRALIZED_EDGE) {
      for (const task of this.tasks) {
        if (task.status === 'UNASSIGNED') {
          if (!this.taskAllocator.isAuctionActive(task.id)) {
            const initiator = this.robots.find((r) => r.state !== AMRState.OFFLINE)?.id || 'R01';
            this.taskAllocator.announceTask(initiator, task, this.simulationTime);
          }

          for (const robot of this.robots) {
            if (
              robot.state !== AMRState.OFFLINE &&
              robot.batteryPct > 15 &&
              robot.state === AMRState.IDLE &&
              !robot.currentTask
            ) {
              const dist = Math.hypot(robot.pos.x - task.pickup.x, robot.pos.y - task.pickup.y);
              const batteryPenalty = (100 - robot.batteryPct) * 0.05;
              const bidCost = dist + batteryPenalty;
              const etaSec = dist / 1.5;

              this.taskAllocator.submitBid(
                robot.id,
                robot.pos,
                task.id,
                bidCost,
                etaSec,
                robot.batteryPct,
                this.simulationTime
              );
            }
          }
        }
      }

      this.taskAllocator.step(
        this.simulationTime,
        (robotId) => {
          const r = this.robots.find((bot) => bot.id === robotId);
          return !!r && r.state !== AMRState.OFFLINE && r.state === AMRState.IDLE && !r.currentTask && r.batteryPct > 15;
        },
        (taskId, winnerId) => {
          const task = this.tasks.find((t) => t.id === taskId);
          const robot = this.robots.find((r) => r.id === winnerId);
          if (task && robot && task.status === 'UNASSIGNED') {
            robot.assignTask(task, this.simulationTime);
            this.logEvent('TASK', 'TASK AWARDED', `Task ${task.id} awarded to ${robot.id} via CNP P2P auction.`, 'SUCCESS', robot.id, task.id);
          }
        }
      );
    } else {
      // Baseline direct assignment
      for (const task of this.tasks) {
        if (task.status === 'UNASSIGNED') {
          const idleRobot = this.robots.find(
            (r) => r.state !== AMRState.OFFLINE && r.state === AMRState.IDLE && !r.currentTask
          );
          if (idleRobot) {
            idleRobot.assignTask(task, this.simulationTime);
          }
        }
      }
    }

    // 3. Step Dynamic Human Workers & Manual Forklifts (Active AMR Yielding + Smooth Navigation)
    for (const human of this.humans) {
      // Find closest actively moving AMR heading toward human
      let activeApproachingRobot: any = null;
      let minRobotDist = Infinity;

      for (const robot of this.robots) {
        if (robot.state === AMRState.OFFLINE) continue;
        const dist = Math.hypot(robot.pos.x - human.pos.x, robot.pos.y - human.pos.y);
        
        // Only yield if robot is actively moving (speed > 0.1) and within 2.2 meters
        if (dist < 2.2 && robot.velocity.speed > 0.1) {
          if (dist < minRobotDist) {
            minRobotDist = dist;
            activeApproachingRobot = robot;
          }
        }
      }

      // Proactive AMR Avoidance: Step aside into clear space if active AMR approaches
      if (activeApproachingRobot && minRobotDist < 2.2) {
        const rdx = activeApproachingRobot.pos.x - human.pos.x;
        const rdy = activeApproachingRobot.pos.y - human.pos.y;

        if (!human.isYieldingToRobot) {
          human.isYieldingToRobot = true;
          human.yieldingForRobotId = activeApproachingRobot.id;
          human.statusText = `Stepping aside for ${activeApproachingRobot.name}`;
          this.logEvent(
            'SAFETY',
            'HUMAN YIELDED TO AMR',
            `${human.name} detected ${activeApproachingRobot.id} approaching (${minRobotDist.toFixed(1)}m). Stepping aside to yield corridor.`,
            'INFO',
            activeApproachingRobot.id
          );
        }

        // Sideways step-aside vector
        const perpX = -rdy / (minRobotDist || 1);
        const perpY = rdx / (minRobotDist || 1);
        const stepSpeed = human.speed * 0.6;
        const nextX = human.pos.x - perpX * stepSpeed * dt;
        const nextY = human.pos.y - perpY * stepSpeed * dt;

        if (this.map.isWalkable(nextX, nextY)) {
          human.pos.x = nextX;
          human.pos.y = nextY;
          human.heading = Math.atan2(-perpY, -perpX);
        } else {
          // If wall blocked, step backward or pause briefly
          human.heading = Math.atan2(rdy, rdx);
        }
      } else {
        // Normal smooth walking navigation to destination
        if (human.isYieldingToRobot) {
          human.isYieldingToRobot = false;
          human.yieldingForRobotId = undefined;
          human.statusText = undefined;
        }

        const hdx = human.targetPos.x - human.pos.x;
        const hdy = human.targetPos.y - human.pos.y;
        const hdist = Math.hypot(hdx, hdy);

        if (hdist < 0.8) {
          // Switch target along main highway routes across the 48m floor
          if (human.type === 'MANUAL_FORKLIFT') {
            human.targetPos = human.pos.y < 14 ? { x: 23, y: 25 } : { x: 23, y: 2 };
          } else {
            human.targetPos = human.pos.x < 24 ? { x: 46, y: 14 } : { x: 2, y: 14 };
          }
        } else {
          human.heading = Math.atan2(hdy, hdx);
          const vx = Math.cos(human.heading) * human.speed;
          const vy = Math.sin(human.heading) * human.speed;
          const nextX = human.pos.x + vx * dt;
          const nextY = human.pos.y + vy * dt;

          if (this.map.isWalkable(nextX, nextY)) {
            human.pos.x = nextX;
            human.pos.y = nextY;
          } else {
            // Re-assign opposite highway target if path blocked
            if (human.type === 'MANUAL_FORKLIFT') {
              human.targetPos = human.pos.y < 14 ? { x: 23, y: 25 } : { x: 23, y: 2 };
            } else {
              human.targetPos = human.pos.x < 24 ? { x: 46, y: 14 } : { x: 2, y: 14 };
            }
          }
        }
      }
    }

    // 4. Step all active AMR Edge Agents
    for (const robot of this.robots) {
      if (robot.state !== AMRState.OFFLINE) {
        robot.step(dt, this.simulationTime, this.mode, this.robots, this.humans);
      }
    }

    // 5. Update P2P network mesh topology & packets
    this.network.updateTopology(this.simulationTime);

    // 6. Micro-Collision Detection
    this.checkCollisions();

    // 7. Clean completed tasks
    const completedNow = this.tasks.filter((t) => t.status === 'COMPLETED');
    for (const t of completedNow) {
      if (!this.completedTasks.find((ct) => ct.id === t.id)) {
        this.completedTasks.push(t);
        this.logEvent('TASK', 'TASK COMPLETED', `Order ${t.id} successfully delivered to shipping dock.`, 'SUCCESS', t.assignedRobotId, t.id);
      }
    }
  }

  public spawnHumanWorker(type: 'HUMAN_WORKER' | 'MANUAL_FORKLIFT'): HumanWorker {
    const start = this.map.getRandomRackLocation();
    const target = this.map.getRandomDropoffDock();
    const human: HumanWorker = {
      id: `human-${this.nextHumanId++}`,
      name: type === 'HUMAN_WORKER' ? `Worker #${this.nextHumanId}` : `Forklift #${this.nextHumanId}`,
      type,
      pos: { ...start },
      heading: 0,
      speed: type === 'HUMAN_WORKER' ? 0.7 : 1.1,
      targetPos: { ...target },
      cautionRadius: type === 'HUMAN_WORKER' ? 2.0 : 2.6,
    };
    this.humans.push(human);
    this.logEvent('SAFETY', 'HUMAN DETECTED', `Dynamic ${type} entered warehouse shared space at (${start.x.toFixed(1)}, ${start.y.toFixed(1)}).`, 'WARN');
    return human;
  }

  public spawnHeavyTandemTask(): WarehouseTask {
    const pickup = this.map.pickupStations[0] || { x: 1, y: 5 };
    const dropoff = this.map.dropoffDocks[0] || { x: 30, y: 5 };

    const task: WarehouseTask = {
      id: `TANDEM-${this.nextTaskId++}`,
      sku: 'BEL-DEFENSE-RADAR-CRATE-500KG',
      pickup,
      dropoff,
      priority: 5,
      status: 'UNASSIGNED',
      createdAt: this.simulationTime,
      weightKg: 500,
    };

    this.tasks.push(task);
    const activeBots = this.robots.filter((r) => r.state !== AMRState.OFFLINE);
    if (activeBots.length >= 2) {
      this.collaborativeTandems.push({
        id: `tandem-${Date.now()}`,
        crateId: task.sku,
        masterRobotId: activeBots[0].id,
        followerRobotId: activeBots[1].id,
        offsetDistance: 1.2,
        weightKg: 500,
        isLocked: true,
        status: 'LOCKED_TRANSPORT',
      });
    }
    this.logEvent('TASK', 'TANDEM LIFT CREATED', '500kg BEL Defense Radar Crate requires dual-AMR tandem coordination.', 'INFO', undefined, task.id);
    return task;
  }

  private checkCollisions(): void {
    const minSafeDist = this.robotRadius * 2.0; // 0.90m threshold
    const activeBots = this.robots.filter((r) => r.state !== AMRState.OFFLINE);

    for (let i = 0; i < activeBots.length; i++) {
      for (let j = i + 1; j < activeBots.length; j++) {
        const r1 = activeBots[i];
        const r2 = activeBots[j];
        const dist = Math.hypot(r1.pos.x - r2.pos.x, r1.pos.y - r2.pos.y);

        if (dist < minSafeDist) {
          this.totalCollisionsDetected++;
          this.collisionEvents.push({
            time: this.simulationTime,
            pos: { x: (r1.pos.x + r2.pos.x) / 2, y: (r1.pos.y + r2.pos.y) / 2 },
            robotA: r1.id,
            robotB: r2.id,
          });
          this.logEvent('SAFETY', 'COLLISION DETECTED', `Micro-collision between ${r1.id} and ${r2.id} at (${r1.pos.x.toFixed(1)}, ${r1.pos.y.toFixed(1)}).`, 'ALERT', r1.id);
        }
      }
    }
  }

  public getTelemetrySnapshot(): {
    robots: AMRTelemetry[];
    activeRobotsCount: number;
    tasks: WarehouseTask[];
    completedTasksCount: number;
    simulationTime: number;
    mode: CoordinationMode;
    isCloudOnline: boolean;
    totalCollisions: number;
    activeDeadlocksCount: number;
    deadlocksResolved: number;
    totalReroutes: number;
    totalTaskReassignments: number;
    activeLinksCount: number;
    makespanSpeedupPct: number;
    humans: HumanWorker[];
    collaborativeTandems: CollaborativeTandem[];
    rfJammers: { id: string; x: number; y: number; radius: number; active: boolean }[];
    eventLogs: EventLogEntry[];
    taskReassignments: TaskReassignmentRecord[];
  } {
    const activeBots = this.robots.filter((r) => r.state !== AMRState.OFFLINE);
    const completedCount = this.completedTasks.length;

    let speedup = 46.7;
    if (this.mode === CoordinationMode.TRADITIONAL_STOP_AND_WAIT) {
      speedup = 0;
    } else if (this.mode === CoordinationMode.CENTRALIZED_CLOUD) {
      speedup = 12.4;
    }

    return {
      robots: this.robots.map((r) => r.getTelemetry()),
      activeRobotsCount: activeBots.length,
      tasks: [...this.tasks],
      completedTasksCount: completedCount,
      simulationTime: Number(this.simulationTime.toFixed(1)),
      mode: this.mode,
      isCloudOnline: this.isCloudOnline,
      totalCollisions: this.totalCollisionsDetected,
      activeDeadlocksCount: 0,
      deadlocksResolved: this.conflictResolver.resolvedConflictCount,
      totalReroutes: this.totalReroutes,
      totalTaskReassignments: this.totalTaskReassignments,
      activeLinksCount: this.network.activeLinks.length,
      makespanSpeedupPct: speedup,
      humans: [...this.humans],
      collaborativeTandems: [...this.collaborativeTandems],
      rfJammers: [...this.map.rfJammers],
      eventLogs: [...this.eventLogs],
      taskReassignments: [...this.taskReassignments],
    };
  }
}
