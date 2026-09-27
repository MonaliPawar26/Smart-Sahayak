import { GridCoord, Position2D, TrajectoryPoint } from './types';
import { WarehouseMap } from './WarehouseMap';

export interface SpaceTimeReservation {
  robotId: string;
  x: number;
  y: number;
  t: number; // Discrete time step
  priority: number;
}

interface STNode {
  x: number;
  y: number;
  t: number;
  heading: number; // 0: East, 1: South, 2: West, 3: North
  g: number;
  h: number;
  f: number;
  parent?: STNode;
  action: 'MOVE' | 'TURN_L' | 'TURN_R' | 'WAIT';
}

export class SpaceTimePlanner {
  private map: WarehouseMap;
  public timeStep: number = 0.5; // 0.5s per discrete step
  public maxHorizonSteps: number = 150; // 75 seconds lookahead for 48m x 28m map layout
  public robotRadius: number = 0.45; // meters
  public maxSpeed: number = 1.2; // m/s
  public turnTimeSec: number = 0.4; // time to turn 90 deg

  constructor(map: WarehouseMap) {
    this.map = map;
  }

  /**
   * Plan a conflict-free space-time path from start to goal avoiding static, dynamic,
   * and peer-reserved space-time cells.
   */
  public plan(
    robotId: string,
    start: Position2D,
    goal: Position2D,
    currentHeadingRad: number,
    startTime: number,
    peerReservations: SpaceTimeReservation[],
    ownPriority: number,
    stationaryPeers: Position2D[] = []
  ): { path: TrajectoryPoint[]; planningTimeMs: number; found: boolean } {
    const t0 = performance.now();

    const startX = Math.round(start.x);
    const startY = Math.round(start.y);
    const goalX = Math.round(goal.x);
    const goalY = Math.round(goal.y);

    if (startX === goalX && startY === goalY) {
      return {
        path: [
          {
            x: start.x,
            y: start.y,
            t: startTime,
            heading: currentHeadingRad,
            speed: 0,
          },
        ],
        planningTimeMs: performance.now() - t0,
        found: true,
      };
    }

    // Convert heading in rad to 0..3 (0: +X East, 1: +Y South, 2: -X West, 3: -Y North)
    const initialHeadingIdx = this.radToHeadingIdx(currentHeadingRad);

    // Build reservation lookup table: "x,y,t" -> priority
    const resMap = new Map<string, number>();
    for (const res of peerReservations) {
      if (res.robotId !== robotId) {
        // Reserve cell with safety time window [-1, 0, +1]
        for (let dt = -1; dt <= 1; dt++) {
          const key = `${res.x},${res.y},${res.t + dt}`;
          const currentP = resMap.get(key) || -1;
          if (res.priority > currentP) {
            resMap.set(key, res.priority);
          }
        }
      }
    }

    const openSet: STNode[] = [];
    const closedSet = new Set<string>();

    const hStart = this.heuristic(startX, startY, goalX, goalY);
    const startNode: STNode = {
      x: startX,
      y: startY,
      t: 0,
      heading: initialHeadingIdx,
      g: 0,
      h: hStart,
      f: hStart,
      action: 'WAIT',
    };

    openSet.push(startNode);

    let goalNode: STNode | null = null;
    let iterations = 0;
    const maxIterations = 3000;

    // Movement vectors: 0: East(+1,0), 1: South(0,+1), 2: West(-1,0), 3: North(0,-1)
    const dx = [1, 0, -1, 0];
    const dy = [0, 1, 0, -1];

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet.splice(lowestIdx, 1)[0];

      if ((current.x === goalX && current.y === goalY) || (Math.hypot(current.x - goalX, current.y - goalY) <= 1.0 && current.t >= 4)) {
        goalNode = current;
        break;
      }

      const stateKey = `${current.x},${current.y},${current.t},${current.heading}`;
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      if (current.t >= this.maxHorizonSteps) {
        if (!goalNode || current.h < goalNode.h) {
          goalNode = current;
        }
        continue;
      }

      const nextT = current.t + 1;

      // 1. Action: MOVE FORWARD in current heading
      const nx = current.x + dx[current.heading];
      const ny = current.y + dy[current.heading];

      if (this.map.isWalkable(nx, ny)) {
        // Check collision with stationary peers
        let isStationaryPeerHere = false;
        for (const sp of stationaryPeers) {
          if (Math.hypot(sp.x - nx, sp.y - ny) < 1.1) {
            isStationaryPeerHere = true;
            break;
          }
        }

        if (!isStationaryPeerHere) {
          const resKey = `${nx},${ny},${nextT}`;
          const peerP = resMap.get(resKey);
          const isBlockedByPeer = peerP !== undefined && peerP >= ownPriority;

          if (!isBlockedByPeer) {
            const swapKey1 = `${nx},${ny},${current.t}`;
            const swapKey2 = `${current.x},${current.y},${nextT}`;
            const swapBlocked = resMap.has(swapKey1) && resMap.has(swapKey2);

            if (!swapBlocked) {
              const g = current.g + 1.0;
              const h = this.heuristic(nx, ny, goalX, goalY);
              openSet.push({
                x: nx,
                y: ny,
                t: nextT,
                heading: current.heading,
                g,
                h,
                f: g + h,
                parent: current,
                action: 'MOVE',
              });
            }
          }
        }
      }

      // 2. Action: TURN LEFT (-90 deg)
      const leftHeading = (current.heading + 3) % 4;
      const leftKey = `${current.x},${current.y},${nextT}`;
      if (!resMap.has(leftKey) || (resMap.get(leftKey) || 0) < ownPriority) {
        const g = current.g + 0.6; // Small turn cost
        const h = current.h;
        openSet.push({
          x: current.x,
          y: current.y,
          t: nextT,
          heading: leftHeading,
          g,
          h,
          f: g + h,
          parent: current,
          action: 'TURN_L',
        });
      }

      // 3. Action: TURN RIGHT (+90 deg)
      const rightHeading = (current.heading + 1) % 4;
      const rightKey = `${current.x},${current.y},${nextT}`;
      if (!resMap.has(rightKey) || (resMap.get(rightKey) || 0) < ownPriority) {
        const g = current.g + 0.6;
        const h = current.h;
        openSet.push({
          x: current.x,
          y: current.y,
          t: nextT,
          heading: rightHeading,
          g,
          h,
          f: g + h,
          parent: current,
          action: 'TURN_R',
        });
      }

      // 4. Action: WAIT / HOLD POSITION
      const waitKey = `${current.x},${current.y},${nextT}`;
      if (!resMap.has(waitKey) || (resMap.get(waitKey) || 0) < ownPriority) {
        const g = current.g + 1.2; // Slight wait penalty
        const h = current.h;
        openSet.push({
          x: current.x,
          y: current.y,
          t: nextT,
          heading: current.heading,
          g,
          h,
          f: g + h,
          parent: current,
          action: 'WAIT',
        });
      }
    }

    const planningTime = performance.now() - t0;

    if (!goalNode) {
      // Fallback: Return in-place safe hold point
      return {
        path: [
          {
            x: start.x,
            y: start.y,
            t: startTime,
            heading: currentHeadingRad,
            speed: 0,
          },
        ],
        planningTimeMs: planningTime,
        found: false,
      };
    }

    // Reconstruct trajectory
    const nodes: STNode[] = [];
    let curr: STNode | undefined = goalNode;
    while (curr) {
      nodes.unshift(curr);
      curr = curr.parent;
    }

    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const headingRad = this.headingIdxToRad(node.heading);
      const isMoving = i > 0 && (nodes[i].x !== nodes[i - 1].x || nodes[i].y !== nodes[i - 1].y);
      const speed = isMoving ? this.maxSpeed : 0;

      trajectory.push({
        x: node.x,
        y: node.y,
        t: startTime + node.t * this.timeStep,
        heading: headingRad,
        speed,
      });
    }

    return {
      path: trajectory,
      planningTimeMs: planningTime,
      found: true,
    };
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    // Manhattan distance + diagonal tie breaker
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) * 1.001;
  }

  private radToHeadingIdx(rad: number): number {
    // Normalize to [0, 2pi)
    let a = rad % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;

    if (a >= (7 * Math.PI) / 4 || a < Math.PI / 4) return 0; // East (0)
    if (a >= Math.PI / 4 && a < (3 * Math.PI) / 4) return 1; // South (pi/2)
    if (a >= (3 * Math.PI) / 4 && a < (5 * Math.PI) / 4) return 2; // West (pi)
    return 3; // North (3pi/2)
  }

  private headingIdxToRad(idx: number): number {
    switch (idx) {
      case 0:
        return 0; // East
      case 1:
        return Math.PI / 2; // South
      case 2:
        return Math.PI; // West
      case 3:
        return (3 * Math.PI) / 2; // North
      default:
        return 0;
    }
  }
}
