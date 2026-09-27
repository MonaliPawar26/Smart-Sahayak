import {
  AMRState,
  AMRTelemetry,
  CoordinationMode,
  DeadlockYieldMessage,
  GridCoord,
  HeartbeatMessage,
  HumanWorker,
  ObstacleGossipMessage,
  P2PMessage,
  Position2D,
  TrajectoryIntentMessage,
  TrajectoryPoint,
  WarehouseTask,
} from './types';
import { WarehouseMap } from './WarehouseMap';
import { SpaceTimePlanner, SpaceTimeReservation } from './SpaceTimePlanner';
import { ConflictResolver } from './ConflictResolver';
import { P2PNetwork } from './P2PNetwork';

export class AMREdgeAgent {
  public id: string;
  public name: string;
  public color: string;
  public pos: Position2D;
  public heading: number; // radians
  public velocity: { vx: number; vy: number; speed: number } = { vx: 0, vy: 0, speed: 0 };
  public state: AMRState = AMRState.IDLE;
  public batteryPct: number = 100;
  public isCharging: boolean = false;
  public hasPayload: boolean = false;
  public payloadWeightKg: number = 0;

  public currentTask?: WarehouseTask;
  public plannedPath: TrajectoryPoint[] = [];
  public currentPathIndex: number = 0;
  public executedPathHistory: Position2D[] = [];
  public distanceTraveledM: number = 0;
  public tasksCompleted: number = 0;

  // Edge Hardware & P2P Networking
  public map: WarehouseMap;
  public planner: SpaceTimePlanner;
  public conflictResolver: ConflictResolver;
  public network: P2PNetwork;

  public peerReservations: Map<string, TrajectoryPoint[]> = new Map();
  public peerPriorities: Map<string, number> = new Map();
  public peerPositions: Map<string, Position2D> = new Map();
  public knownDynamicObstacles: Set<string> = new Set();

  public lastBroadcastTime: number = 0;
  public broadcastIntervalSec: number = 0.1; // High-frequency 10 Hz P2P broadcast rate
  public stateTimer: number = 0;
  public stopWaitDurationSec: number = 0;

  // Conflict & Yielding state
  public isYielding: boolean = false;
  public yieldBayTarget?: Position2D;
  public lastConflictResolved?: string;
  public isPlatooning: boolean = false;
  public platoonLeaderId?: string;
  public isRFJammed: boolean = false;
  public humanDetected: boolean = false;

  // Hardware emulation metrics
  public edgeMetrics = {
    cpuUsagePct: 15,
    ramUsageMb: 185,
    planningLatencyMs: 2.1,
    packetRatePerSec: 12,
    packetsSent: 0,
    packetsReceived: 0,
    packetsDropped: 0,
    isInDeadZone: false,
    rfSignalDb: -45,
  };

  constructor(
    id: string,
    name: string,
    color: string,
    initialPos: Position2D,
    initialHeading: number,
    map: WarehouseMap,
    network: P2PNetwork,
    conflictResolver: ConflictResolver
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.pos = { ...initialPos };
    this.heading = initialHeading;
    this.map = map;
    this.network = network;
    this.conflictResolver = conflictResolver;
    this.planner = new SpaceTimePlanner(map);

    // Register with P2P network
    this.network.registerNode(this.id, (msg) => this.onP2PMessage(msg), this.pos);
  }

  public onP2PMessage(msg: P2PMessage): void {
    this.edgeMetrics.packetsReceived++;

    switch (msg.type) {
      case 'HEARTBEAT': {
        const hb = msg as HeartbeatMessage;
        this.peerPositions.set(hb.senderId, hb.senderPos);
        break;
      }

      case 'TRAJECTORY_INTENT': {
        const intent = msg as TrajectoryIntentMessage;
        this.peerReservations.set(intent.senderId, intent.trajectory);
        this.peerPriorities.set(intent.senderId, intent.priorityScore);
        break;
      }

      case 'OBSTACLE_GOSSIP': {
        const obs = msg as ObstacleGossipMessage;
        const key = `${obs.obstaclePos.x},${obs.obstaclePos.y}`;
        if (!this.knownDynamicObstacles.has(key)) {
          this.knownDynamicObstacles.add(key);
          this.map.setDynamicObstacle(obs.obstaclePos.x, obs.obstaclePos.y, obs.isBlocked);

          // If current path passes through this newly discovered obstacle, replan immediately!
          if (this.isPathBlockedByObstacle(obs.obstaclePos)) {
            this.replanCurrentMission(msg.timestamp);
          }
        }
        break;
      }

      case 'DEADLOCK_YIELD': {
        const yieldMsg = msg as DeadlockYieldMessage;
        if (yieldMsg.masterRobotId === this.id) {
          this.lastConflictResolved = `Peer ${yieldMsg.yieldingRobotId} yielding to Bay (${yieldMsg.bayCoord.x}, ${yieldMsg.bayCoord.y})`;
        }
        break;
      }
    }
  }

  private isPathBlockedByObstacle(obs: GridCoord): boolean {
    for (let i = this.currentPathIndex; i < this.plannedPath.length; i++) {
      const pt = this.plannedPath[i];
      if (Math.round(pt.x) === obs.x && Math.round(pt.y) === obs.y) {
        return true;
      }
    }
    return false;
  }

  public assignTask(task: WarehouseTask, currentTime: number): void {
    this.currentTask = task;
    task.status = 'IN_PROGRESS';
    task.assignedRobotId = this.id;
    this.state = AMRState.MOVING_TO_PICKUP;
    this.hasPayload = false;
    this.replanTo(task.pickup, currentTime);
  }

  public replanTo(destination: Position2D, currentTime: number): void {
    const reservations: SpaceTimeReservation[] = [];
    const ownPriority = this.getPriorityScore();

    for (const [peerId, traj] of this.peerReservations.entries()) {
      const p = this.peerPriorities.get(peerId) || 50;
      for (const pt of traj) {
        const timeOffsetSec = pt.t - currentTime;
        if (timeOffsetSec >= 0 && timeOffsetSec <= 25) {
          reservations.push({
            robotId: peerId,
            x: Math.round(pt.x),
            y: Math.round(pt.y),
            t: Math.round(timeOffsetSec / 0.5), // 0.5s step
            priority: p,
          });
        }
      }
    }

    const stationaryPeers: Position2D[] = [];
    for (const [peerId, pos] of this.peerPositions.entries()) {
      if (peerId !== this.id) {
        stationaryPeers.push(pos);
      }
    }

    const res = this.planner.plan(
      this.id,
      this.pos,
      destination,
      this.heading,
      currentTime,
      reservations,
      ownPriority,
      stationaryPeers
    );

    this.plannedPath = res.path;
    this.currentPathIndex = 0;
    this.edgeMetrics.planningLatencyMs = Number(res.planningTimeMs.toFixed(2));
    this.edgeMetrics.cpuUsagePct = Math.min(85, Math.max(25, 20 + res.planningTimeMs * 4));

    // Broadcast updated intent to peers
    this.broadcastTrajectoryIntent(currentTime);
  }

  public replanCurrentMission(currentTime: number): void {
    if (this.state === AMRState.MOVING_TO_PICKUP && this.currentTask) {
      this.replanTo(this.currentTask.pickup, currentTime);
    } else if (this.state === AMRState.MOVING_TO_DROPOFF && this.currentTask) {
      this.replanTo(this.currentTask.dropoff, currentTime);
    } else if (this.state === AMRState.RETURNING_TO_CHARGER) {
      const pad = this.map.findNearestChargingPad(this.pos);
      this.replanTo(pad, currentTime);
    }
  }

  public broadcastTrajectoryIntent(currentTime: number): void {
    const intentMsg: TrajectoryIntentMessage = {
      id: `intent-${this.id}-${Date.now()}`,
      type: 'TRAJECTORY_INTENT',
      senderId: this.id,
      senderPos: this.pos,
      trajectory: this.plannedPath.slice(this.currentPathIndex, this.currentPathIndex + 20),
      priorityScore: this.getPriorityScore(),
      destination: this.plannedPath[this.plannedPath.length - 1] || this.pos,
      isUrgent: this.batteryPct < 20 || (this.currentTask?.priority ?? 1) >= 4,
      timestamp: currentTime,
      ttl: 3,
    };

    this.network.broadcast(this.id, intentMsg, currentTime);
    this.edgeMetrics.packetsSent++;
  }

  public broadcastObstacleDiscovered(obs: GridCoord): void {
    const msg: ObstacleGossipMessage = {
      id: `obs-gossip-${obs.x}-${obs.y}-${Date.now()}`,
      type: 'OBSTACLE_GOSSIP',
      senderId: this.id,
      senderPos: this.pos,
      obstaclePos: obs,
      isBlocked: true,
      detectedAt: Date.now(),
      confidence: 1.0,
      originRobotId: this.id,
      timestamp: Date.now() / 1000,
      ttl: 4,
    };

    this.network.broadcast(this.id, msg, Date.now() / 1000);
    this.edgeMetrics.packetsSent++;
  }

  public getPriorityScore(): number {
    const basePriority = this.conflictResolver.calculatePriority(this.getTelemetry());
    // Priority Aging (Starvation Avoidance): gain +5 priority score per second waited (max +30)
    const agingBonus = Math.min(30, 5 * this.stopWaitDurationSec);
    return basePriority + agingBonus;
  }

  /**
   * Main AMR Edge Control Loop Step
   */
  public step(
    dt: number,
    currentTime: number,
    mode: CoordinationMode,
    allRobots: AMREdgeAgent[],
    humans: HumanWorker[] = []
  ): void {
    // 1. Record Traffic Density for Congestion Heatmap
    this.map.recordTraffic(this.pos.x, this.pos.y);

    // 2. Update Dead Zone & RF Jammer Cyber Defense state
    const dz = this.map.isInDeadZone(this.pos);
    const jammer = this.map.isInRFJammer(this.pos);
    this.isRFJammed = jammer.isJammed;
    this.edgeMetrics.isInDeadZone = dz.inDeadZone || jammer.isJammed;
    this.edgeMetrics.rfSignalDb = jammer.isJammed
      ? -115
      : dz.inDeadZone
      ? -85 - dz.attenuation * 0.1
      : -45 - Math.random() * 5;

    // 3. Human Worker & Manual Forklift LiDAR Safety Perception
    this.humanDetected = false;
    for (const human of humans) {
      const hd = Math.hypot(human.pos.x - this.pos.x, human.pos.y - this.pos.y);
      if (hd < 2.8) {
        this.humanDetected = true;
        // Strict LiDAR Safety Radius: If human/forklift is within 1.85m, halt immediately!
        if (hd < 1.85) {
          this.velocity = { vx: 0, vy: 0, speed: 0 };
          this.stopWaitDurationSec += dt;
          return; // Stop step execution so robot never advances into human/forklift
        }
      }
    }

    // 4. Ad-Hoc Highway Platooning Detection
    this.isPlatooning = false;
    this.platoonLeaderId = undefined;
    const currentCell = this.map.getCellType(this.pos.x, this.pos.y);
    if (currentCell === 'HIGHWAY' && this.velocity.speed > 0.4) {
      for (const peer of allRobots) {
        if (peer.id === this.id) continue;
        const pDist = Math.hypot(peer.pos.x - this.pos.x, peer.pos.y - this.pos.y);
        // If peer is in front within 1.4m..3.2m traveling same direction
        if (pDist >= 1.4 && pDist <= 3.2 && peer.velocity.speed > 0.4) {
          const hDiff = Math.abs(this.angleDifference(peer.heading, this.heading));
          if (hDiff < Math.PI / 4) {
            this.isPlatooning = true;
            this.platoonLeaderId = peer.id;
            break;
          }
        }
      }
    }

    // 5. Battery Dynamics
    if (this.isCharging) {
      this.batteryPct = Math.min(100, this.batteryPct + dt * 4.0); // Rapid 4%/s charging
      if (this.batteryPct >= 98) {
        this.isCharging = false;
        this.state = AMRState.IDLE;
      }
    } else {
      const speedFactor = this.velocity.speed > 0.1 ? 1.0 : 0.1;
      const loadFactor = this.hasPayload ? 1.4 : 1.0;
      this.batteryPct = Math.max(0, this.batteryPct - dt * 0.04 * speedFactor * loadFactor);

      // Low battery auto-charge trigger
      if (this.batteryPct < 15 && this.state !== AMRState.RETURNING_TO_CHARGER && !this.isCharging) {
        this.state = AMRState.RETURNING_TO_CHARGER;
        const pad = this.map.findNearestChargingPad(this.pos);
        this.replanTo(pad, currentTime);
      }
    }

    // 6. Periodic P2P Heartbeat (if not RF Jammed)
    if (!this.isRFJammed && currentTime - this.lastBroadcastTime > this.broadcastIntervalSec) {
      this.lastBroadcastTime = currentTime;
      const hb: HeartbeatMessage = {
        id: `hb-${this.id}-${currentTime.toFixed(1)}`,
        type: 'HEARTBEAT',
        senderId: this.id,
        senderPos: this.pos,
        battery: this.batteryPct,
        speed: this.velocity.speed,
        heading: this.heading,
        state: this.state,
        hasPayload: this.hasPayload,
        activeTaskId: this.currentTask?.id,
        timestamp: currentTime,
        ttl: 2,
      };
      this.network.broadcast(this.id, hb, currentTime);
      this.network.updateNodePosition(this.id, this.pos);
    }

    // 7. Centralized Mode Failure Emulation in Dead Zones / Jammer
    if (mode === CoordinationMode.CENTRALIZED_CLOUD && (dz.inDeadZone || jammer.isJammed)) {
      // Cloud disconnect stall
      this.velocity = { vx: 0, vy: 0, speed: 0 };
      this.state = AMRState.STOP_WAIT;
      this.stopWaitDurationSec += dt;
      return;
    }

    // 5. Traditional Stop-and-Wait Mode Collision Check
    if (mode === CoordinationMode.TRADITIONAL_STOP_AND_WAIT) {
      let mustStop = false;
      const myP = this.getPriorityScore();

      for (const peer of allRobots) {
        if (peer.id === this.id || peer.state === AMRState.OFFLINE) continue;
        const dist = Math.hypot(peer.pos.x - this.pos.x, peer.pos.y - this.pos.y);
        if (dist < 2.2) {
          // If peer has higher priority (or equal ID tiebreaker), I must stop and wait
          if (peer.getPriorityScore() >= myP) {
            mustStop = true;
            break;
          }
        }
      }
      if (mustStop && this.state !== AMRState.LOADING && this.state !== AMRState.UNLOADING) {
        this.state = AMRState.STOP_WAIT;
        this.velocity = { vx: 0, vy: 0, speed: 0 };
        this.stopWaitDurationSec += dt;
        return;
      } else if (this.state === AMRState.STOP_WAIT) {
        // Resume previous state
        this.state = this.hasPayload ? AMRState.MOVING_TO_DROPOFF : (this.currentTask ? AMRState.MOVING_TO_PICKUP : AMRState.IDLE);
      }
    }

    // 6. Decentralized Collision Prevention & Reactive Safety Envelope
    if (mode === CoordinationMode.DECENTRALIZED_EDGE && !this.isYielding) {
      for (const peer of allRobots) {
        if (peer.id === this.id) continue;

        // Proactive Head-on Deadlock resolution in narrow aisles
        if (!peer.isYielding) {
          const deadlock = this.conflictResolver.checkHeadOnDeadlock(this.getTelemetry(), peer.getTelemetry());
          if (deadlock && deadlock.isDeadlock) {
            if (deadlock.yieldingRobotId === this.id && deadlock.bayCoord) {
              // We yield! Plan backtrack into bypass bay
              this.isYielding = true;
              this.state = AMRState.YIELDING_PULL_IN;
              this.yieldBayTarget = { ...deadlock.bayCoord };
              this.plannedPath = this.conflictResolver.generateBypassBayTrajectory(
                this.pos,
                this.heading,
                deadlock.bayCoord,
                currentTime
              );
              this.currentPathIndex = 0;

              const yieldMsg: DeadlockYieldMessage = {
                id: `yield-${this.id}-${Date.now()}`,
                type: 'DEADLOCK_YIELD',
                senderId: this.id,
                senderPos: this.pos,
                yieldingRobotId: this.id,
                masterRobotId: deadlock.masterRobotId!,
                bayCoord: deadlock.bayCoord,
                timestamp: currentTime,
                ttl: 3,
              };
              this.network.broadcast(this.id, yieldMsg, currentTime);
              break;
            }
          }
        }

        // Dynamic spatial envelope safety buffer (1.60m safety bubble)
        const dist = Math.hypot(peer.pos.x - this.pos.x, peer.pos.y - this.pos.y);
        if (dist < 1.60) {
          const myP = this.getPriorityScore();
          const peerP = peer.getPriorityScore();

          // Total Ordering Deterministic Tie-Breaker:
          // Peer is higher if score is higher, OR if score is equal and peer.id comes first alphabetically (e.g. R01 < R02 < R04)
          const isPeerHigher = peerP > myP || (peerP === myP && peer.id < this.id);

          if (isPeerHigher) {
            // Yielding robot: halt and gently back away if within 1.35m
            if (dist < 1.35) {
              const dx = peer.pos.x - this.pos.x;
              const dy = peer.pos.y - this.pos.y;
              const backX = this.pos.x - (dx / (dist || 1)) * 0.4 * dt;
              const backY = this.pos.y - (dy / (dist || 1)) * 0.4 * dt;

              // Verify backing position doesn't collide with any other peer behind
              let isBackingClear = this.map.isWalkable(backX, backY);
              for (const other of allRobots) {
                if (other.id === this.id || other.id === peer.id) continue;
                if (Math.hypot(other.pos.x - backX, other.pos.y - backY) < 1.25) {
                  isBackingClear = false;
                  break;
                }
              }

              if (isBackingClear) {
                this.pos.x = backX;
                this.pos.y = backY;
              }
            }
            this.velocity = { vx: 0, vy: 0, speed: 0 };
            this.stopWaitDurationSec += dt;
            return;
          } else {
            // Master robot: if yielding peer is within 1.30m, pause until peer clears to 1.30m margin
            if (dist < 1.30) {
              this.velocity = { vx: 0, vy: 0, speed: 0 };
              return;
            }
            this.stopWaitDurationSec = 0;
          }
        }
      }
    }

    // 7. State Machine Execution & Path Navigation
    switch (this.state) {
      case AMRState.IDLE:
        if (this.plannedPath.length > 0 && this.currentPathIndex < this.plannedPath.length) {
          this.executeTrajectoryStep(dt, currentTime);
        } else {
          this.velocity = { vx: 0, vy: 0, speed: 0 };
          this.stateTimer += dt;
          if (this.stateTimer > 1.0) {
            this.stateTimer = 0;
            const targetStation = this.map.pickupStations[Math.floor(Math.random() * this.map.pickupStations.length)] || { x: 3, y: 14 };
            this.replanTo(targetStation, currentTime);
          }
        }
        break;

      case AMRState.LOADING:
        this.velocity = { vx: 0, vy: 0, speed: 0 };
        this.stateTimer += dt;
        if (this.stateTimer >= 0.8) {
          this.stateTimer = 0;
          this.hasPayload = true;
          this.payloadWeightKg = this.currentTask?.weightKg || 120;
          this.state = AMRState.MOVING_TO_DROPOFF;
          if (this.currentTask) {
            this.replanTo(this.currentTask.dropoff, currentTime);
          }
        }
        break;

      case AMRState.UNLOADING:
        this.velocity = { vx: 0, vy: 0, speed: 0 };
        this.stateTimer += dt;
        if (this.stateTimer >= 0.8) {
          this.stateTimer = 0;
          this.hasPayload = false;
          this.payloadWeightKg = 0;
          this.tasksCompleted++;
          if (this.currentTask) {
            this.currentTask.status = 'COMPLETED';
            this.currentTask.completedAt = currentTime;
            this.currentTask = undefined;
          }
          this.state = AMRState.IDLE;

          // Pull slightly forward into staging lane to clear the dock for next robot
          const currentCell = this.map.getCellType(this.pos.x, this.pos.y);
          if (currentCell === 'DROPOFF_DOCK' || currentCell === 'PICKUP_STATION' || currentCell === 'BYPASS_BAY') {
            const stagingX = this.pos.x > 16 ? this.map.width - 4 : 3;
            const stagingY = Math.min(this.map.height - 3, Math.max(2, this.pos.y));
            if (this.map.isWalkable(stagingX, stagingY)) {
              this.replanTo({ x: stagingX, y: stagingY }, currentTime);
            }
          }
        }
        break;

      case AMRState.MOVING_TO_PICKUP:
      case AMRState.MOVING_TO_DROPOFF:
      case AMRState.RETURNING_TO_CHARGER:
      case AMRState.YIELDING_PULL_IN:
        this.executeTrajectoryStep(dt, currentTime);
        break;
    }

    // CPU load decay
    this.edgeMetrics.cpuUsagePct = Math.max(12, this.edgeMetrics.cpuUsagePct - dt * 10);
  }

  private executeTrajectoryStep(dt: number, currentTime: number): void {
    if (this.plannedPath.length === 0 || this.currentPathIndex >= this.plannedPath.length) {
      // Reached path end
      if (this.state === AMRState.MOVING_TO_PICKUP) {
        this.state = AMRState.LOADING;
        this.stateTimer = 0;
      } else if (this.state === AMRState.MOVING_TO_DROPOFF) {
        this.state = AMRState.UNLOADING;
        this.stateTimer = 0;
      } else if (this.state === AMRState.RETURNING_TO_CHARGER) {
        this.state = AMRState.CHARGING;
        this.isCharging = true;
      } else if (this.state === AMRState.YIELDING_PULL_IN) {
        // Finished yielding in bypass bay, wait then resume original task
        this.isYielding = false;
        this.state = this.hasPayload ? AMRState.MOVING_TO_DROPOFF : (this.currentTask ? AMRState.MOVING_TO_PICKUP : AMRState.IDLE);
        this.replanCurrentMission(currentTime);
      }
      this.velocity = { vx: 0, vy: 0, speed: 0 };
      return;
    }

    const targetPt = this.plannedPath[this.currentPathIndex];
    const dx = targetPt.x - this.pos.x;
    const dy = targetPt.y - this.pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.2) {
      // Reached waypoint, advance
      this.currentPathIndex++;
      return;
    }

    // Steer towards target waypoint
    const desiredHeading = Math.atan2(dy, dx);
    const headingDiff = this.angleDifference(desiredHeading, this.heading);

    // Rotate heading smoothly
    const maxRot = 4.0 * dt;
    if (Math.abs(headingDiff) > maxRot) {
      this.heading += Math.sign(headingDiff) * maxRot;
    } else {
      this.heading = desiredHeading;
    }

    // Move forward if heading is aligned within 45 deg
    const speed = Math.abs(headingDiff) < Math.PI / 4 ? Math.min(1.6, Math.max(0.6, dist * 2.5)) : 0.4;
    const vx = Math.cos(this.heading) * speed;
    const vy = Math.sin(this.heading) * speed;

    this.velocity = { vx, vy, speed };

    const nextX = this.pos.x + vx * dt;
    const nextY = this.pos.y + vy * dt;

    // Strict Dynamic Collision Barrier: Ensure next position never breaches 0.95m buffer to any peer
    let wouldCollide = false;
    for (const [peerId, peerPos] of this.peerPositions.entries()) {
      if (peerId !== this.id) {
        const nextDist = Math.hypot(peerPos.x - nextX, peerPos.y - nextY);
        if (nextDist < 0.95) {
          wouldCollide = true;
          break;
        }
      }
    }

    if (wouldCollide) {
      this.velocity = { vx: 0, vy: 0, speed: 0 };
      return;
    }

    // Record distance
    const stepDist = Math.hypot(nextX - this.pos.x, nextY - this.pos.y);
    this.distanceTraveledM += stepDist;

    this.pos.x = nextX;
    this.pos.y = nextY;

    // Track path history
    if (this.executedPathHistory.length === 0 || Math.hypot(this.pos.x - this.executedPathHistory[this.executedPathHistory.length - 1].x, this.pos.y - this.executedPathHistory[this.executedPathHistory.length - 1].y) > 0.4) {
      this.executedPathHistory.push({ ...this.pos });
      if (this.executedPathHistory.length > 50) {
        this.executedPathHistory.shift();
      }
    }
  }

  private angleDifference(target: number, current: number): number {
    let diff = (target - current) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  public getTelemetry(): AMRTelemetry {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      pos: { ...this.pos },
      heading: this.heading,
      velocity: { ...this.velocity },
      state: this.state,
      batteryPct: Math.round(this.batteryPct),
      isCharging: this.isCharging,
      hasPayload: this.hasPayload,
      payloadWeightKg: this.payloadWeightKg,
      currentTask: this.currentTask,
      plannedPath: this.plannedPath.slice(this.currentPathIndex),
      executedPathHistory: [...this.executedPathHistory],
      distanceTraveledM: Number(this.distanceTraveledM.toFixed(1)),
      tasksCompleted: this.tasksCompleted,
      edgeMetrics: { ...this.edgeMetrics },
      lastConflictResolved: this.lastConflictResolved,
      isYielding: this.isYielding,
      yieldBayTarget: this.yieldBayTarget,
      isPlatooning: this.isPlatooning,
      platoonLeaderId: this.platoonLeaderId,
      isRFJammed: this.isRFJammed,
      humanDetected: this.humanDetected,
    };
  }
}
