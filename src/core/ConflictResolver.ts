import { AMRState, AMRTelemetry, ConflictNegotiationMessage, DeadlockYieldMessage, GridCoord, Position2D, TrajectoryPoint } from './types';
import { WarehouseMap } from './WarehouseMap';

export interface ConflictRecord {
  id: string;
  type: 'HEAD_ON_AISLE' | 'CROSS_INTERSECTION' | 'DYNAMIC_BLOCKED_AISLE';
  robotA: string;
  robotB?: string;
  location: Position2D;
  resolvedAt?: number;
  strategy: 'REVERSE_TO_BAY' | 'PRIORITY_YIELD' | 'LOCAL_REROUTE';
  status: 'DETECTED' | 'RESOLVING' | 'RESOLVED';
}

export class ConflictResolver {
  private map: WarehouseMap;
  public activeConflicts: Map<string, ConflictRecord> = new Map();
  public resolvedConflictCount: number = 0;
  public totalDeadlocksEncountered: number = 0;

  constructor(map: WarehouseMap) {
    this.map = map;
  }

  /**
   * Calculate dynamic priority score for an AMR
   * Factors:
   * 1. Task Priority (1..5)
   * 2. Payload status (loaded robots have higher inertia and higher priority)
   * 3. Battery state of charge (low battery robots going to charge have high urgency)
   * 4. Distance to goal / distance to bypass bay
   */
  public calculatePriority(robot: AMRTelemetry): number {
    let score = 50;

    // Task Urgency
    if (robot.currentTask) {
      score += robot.currentTask.priority * 15;
    }

    // Has Payload
    if (robot.hasPayload) {
      score += 20;
    }

    // Low battery returning to charger gets priority
    if (robot.batteryPct < 20 && robot.state === AMRState.RETURNING_TO_CHARGER) {
      score += 40;
    }

    // State considerations
    if (robot.state === AMRState.YIELDING_PULL_IN) {
      score -= 30; // Already yielding
    }

    // Tie-breaker based on ID hash to ensure deterministic consensus
    const idHash = robot.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10;
    score += idHash * 0.1;

    return score;
  }

  /**
   * Detect potential head-on deadlock between two robots in narrow corridors
   */
  public checkHeadOnDeadlock(
    robotA: AMRTelemetry,
    robotB: AMRTelemetry
  ): { isDeadlock: boolean; yieldingRobotId?: string; masterRobotId?: string; bayCoord?: GridCoord } | null {
    // 1. Check if both are in an AISLE
    const cellA = this.map.getCellType(robotA.pos.x, robotA.pos.y);
    const cellB = this.map.getCellType(robotB.pos.x, robotB.pos.y);

    const dist = Math.hypot(robotA.pos.x - robotB.pos.x, robotA.pos.y - robotB.pos.y);

    // If within 5 meters in or near an aisle
    if (dist < 5.0 && dist > 0.1) {
      // Check if trajectories are facing each other
      const dx = robotB.pos.x - robotA.pos.x;
      const dy = robotB.pos.y - robotA.pos.y;
      const angleAB = Math.atan2(dy, dx);

      const headingDiffA = Math.abs(this.angleDifference(robotA.heading, angleAB));
      const headingDiffB = Math.abs(this.angleDifference(robotB.heading, angleAB + Math.PI));

      // Facing roughly towards each other (within 60 degrees)
      if (headingDiffA < Math.PI / 3 && headingDiffB < Math.PI / 3) {
        // Find nearest bypass bay for either robot
        const bayA = this.map.findNearestBypassBay(robotA.pos);
        const bayB = this.map.findNearestBypassBay(robotB.pos);

        const priorityA = this.calculatePriority(robotA);
        const priorityB = this.calculatePriority(robotB);

        this.totalDeadlocksEncountered++;

        if (priorityA >= priorityB) {
          // Robot B yields and reverses into nearest bay
          const bay = bayB || bayA || { x: 4, y: 3 };
          return {
            isDeadlock: true,
            yieldingRobotId: robotB.id,
            masterRobotId: robotA.id,
            bayCoord: bay,
          };
        } else {
          // Robot A yields
          const bay = bayA || bayB || { x: 4, y: 3 };
          return {
            isDeadlock: true,
            yieldingRobotId: robotA.id,
            masterRobotId: robotB.id,
            bayCoord: bay,
          };
        }
      }
    }

    return null;
  }

  /**
   * Generates a smooth pull-in / backtrack trajectory to a bypass bay
   */
  public generateBypassBayTrajectory(
    currentPos: Position2D,
    currentHeading: number,
    bayCoord: GridCoord,
    startTime: number
  ): TrajectoryPoint[] {
    const trajectory: TrajectoryPoint[] = [];
    const stepTime = 0.4;
    let t = startTime;

    // Step 1: Reverse or turn towards bay
    const dx = bayCoord.x - currentPos.x;
    const dy = bayCoord.y - currentPos.y;
    const bayHeading = Math.atan2(dy, dx);

    // Intermediate waypoint at aisle entrance of bay
    const intermediateX = bayCoord.x;
    const intermediateY = currentPos.y;

    trajectory.push({
      x: currentPos.x,
      y: currentPos.y,
      t: t,
      heading: currentHeading,
      speed: 0.6,
    });

    t += stepTime;
    trajectory.push({
      x: intermediateX,
      y: intermediateY,
      t: t,
      heading: bayHeading,
      speed: 0.8,
    });

    t += stepTime * 1.5;
    // Enter into the bay
    trajectory.push({
      x: bayCoord.x,
      y: bayCoord.y,
      t: t,
      heading: bayHeading,
      speed: 0.5,
    });

    // Hold / Wait in bay for 4 seconds to let master robot pass
    for (let waitSec = 1; waitSec <= 4; waitSec++) {
      t += 1.0;
      trajectory.push({
        x: bayCoord.x,
        y: bayCoord.y,
        t: t,
        heading: bayHeading,
        speed: 0,
      });
    }

    return trajectory;
  }

  private angleDifference(a: number, b: number): number {
    let diff = (a - b) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}
