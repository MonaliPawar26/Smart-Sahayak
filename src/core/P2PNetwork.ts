import { P2PMessage, Position2D } from './types';
import { WarehouseMap } from './WarehouseMap';

export interface MeshLink {
  fromId: string;
  toId: string;
  fromPos: Position2D;
  toPos: Position2D;
  signalQuality: number; // 0 to 1
  latencyMs: number;
}

export interface InFlightPacket {
  id: string;
  message: P2PMessage;
  fromPos: Position2D;
  toPos: Position2D;
  targetRobotId?: string;
  dispatchTime: number;
  deliveryTime: number;
  dropped: boolean;
  delivered?: boolean;
}

export class P2PNetwork {
  public maxCommRadius: number = 60.0; // In warehouse meters (covers full 48x28m floor)
  public baseLatencyMs: number = 2; // Fast sub-millisecond edge P2P transmission
  public jitterMs: number = 2;
  public basePacketLossRate: number = 0.01; // 1% baseline drop rate
  public messageLog: P2PMessage[] = [];
  public maxLogSize: number = 200;
  public activeLinks: MeshLink[] = [];
  public inFlightPackets: InFlightPacket[] = [];
  private seenMessageIds: Set<string> = new Set();
  private map: WarehouseMap;

  // Registered nodes in network: robotId -> callback function
  private nodeHandlers: Map<string, (msg: P2PMessage) => void> = new Map();
  private nodePositions: Map<string, Position2D> = new Map();

  constructor(map: WarehouseMap) {
    this.map = map;
  }

  public registerNode(robotId: string, onMessage: (msg: P2PMessage) => void, initialPos: Position2D): void {
    this.nodeHandlers.set(robotId, onMessage);
    this.nodePositions.set(robotId, initialPos);
  }

  public unregisterNode(robotId: string): void {
    this.nodeHandlers.delete(robotId);
    this.nodePositions.delete(robotId);
  }

  public updateNodePosition(robotId: string, pos: Position2D): void {
    this.nodePositions.set(robotId, pos);
  }

  /**
   * Broadcast a message to all neighboring robots within direct communication radius.
   * Also supports multi-hop Gossip with TTL.
   */
  public broadcast(senderId: string, message: P2PMessage, currentTime: number): void {
    const senderPos = this.nodePositions.get(senderId);
    if (!senderPos) return;

    // Log message for protocol inspector
    this.logMessage(message);

    const senderDz = this.map.isInDeadZone(senderPos);

    for (const [targetId, handler] of this.nodeHandlers.entries()) {
      if (targetId === senderId) continue;

      const targetPos = this.nodePositions.get(targetId);
      if (!targetPos) continue;

      const dist = Math.hypot(targetPos.x - senderPos.x, targetPos.y - senderPos.y);

      // Check range
      if (dist <= this.maxCommRadius) {
        const targetDz = this.map.isInDeadZone(targetPos);

        // Calculate combined RF attenuation
        let lossRate = this.basePacketLossRate;
        if (senderDz.inDeadZone) {
          lossRate += (senderDz.attenuation / 100) * 0.8;
        }
        if (targetDz.inDeadZone) {
          lossRate += (targetDz.attenuation / 100) * 0.8;
        }
        lossRate = Math.min(0.95, lossRate);

        const isDropped = Math.random() < lossRate;
        const latency = (this.baseLatencyMs + Math.random() * this.jitterMs + (dist / this.maxCommRadius) * 10) / 1000;

        const packet: InFlightPacket = {
          id: `${message.id}->${targetId}`,
          message: { ...message },
          fromPos: { ...senderPos },
          toPos: { ...targetPos },
          targetRobotId: targetId,
          dispatchTime: currentTime,
          deliveryTime: currentTime + latency,
          dropped: isDropped,
        };

        this.inFlightPackets.push(packet);
      }
    }
  }

  /**
   * Unicast direct point-to-point message to a specific robot.
   */
  public sendDirect(senderId: string, targetId: string, message: P2PMessage, currentTime: number): void {
    const senderPos = this.nodePositions.get(senderId);
    const targetPos = this.nodePositions.get(targetId);
    const handler = this.nodeHandlers.get(targetId);

    if (!senderPos || !targetPos || !handler) return;

    this.logMessage(message);

    const dist = Math.hypot(targetPos.x - senderPos.x, targetPos.y - senderPos.y);
    if (dist <= this.maxCommRadius * 1.5) {
      const senderDz = this.map.isInDeadZone(senderPos);
      const targetDz = this.map.isInDeadZone(targetPos);

      let lossRate = this.basePacketLossRate;
      if (senderDz.inDeadZone || targetDz.inDeadZone) {
        lossRate = 0.5;
      }

      const isDropped = Math.random() < lossRate;
      const latency = (this.baseLatencyMs + Math.random() * this.jitterMs) / 1000;

      const packet: InFlightPacket = {
        id: `${message.id}->${targetId}`,
        message: { ...message },
        fromPos: { ...senderPos },
        toPos: { ...targetPos },
        targetRobotId: targetId,
        dispatchTime: currentTime,
        deliveryTime: currentTime + latency,
        dropped: isDropped,
      };

      this.inFlightPackets.push(packet);
    }
  }

  /**
   * Update active mesh topology links, deliver due in-flight packets, and purge expired packets
   */
  public updateTopology(currentTime: number): void {
    this.activeLinks = [];
    const entries = Array.from(this.nodePositions.entries());

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [id1, pos1] = entries[i];
        const [id2, pos2] = entries[j];
        const dist = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);

        if (dist <= this.maxCommRadius) {
          const dz1 = this.map.isInDeadZone(pos1);
          const dz2 = this.map.isInDeadZone(pos2);
          const signalQuality = Math.max(0.05, 1.0 - (dist / this.maxCommRadius) - (dz1.inDeadZone ? 0.4 : 0) - (dz2.inDeadZone ? 0.4 : 0));

          this.activeLinks.push({
            fromId: id1,
            toId: id2,
            fromPos: pos1,
            toPos: pos2,
            signalQuality: Math.max(0.1, signalQuality),
            latencyMs: this.baseLatencyMs + Math.round((dist / this.maxCommRadius) * 20),
          });
        }
      }
    }

    // Process & deliver due in-flight packets based on simulation time
    for (const packet of this.inFlightPackets) {
      if (!packet.delivered && !packet.dropped && currentTime >= packet.deliveryTime && packet.targetRobotId) {
        packet.delivered = true;
        const handler = this.nodeHandlers.get(packet.targetRobotId);
        if (handler) {
          handler(packet.message);
        }
      }
    }

    // Filter out delivered packets from visual buffer after 0.8s
    this.inFlightPackets = this.inFlightPackets.filter(
      (p) => currentTime - p.dispatchTime < 0.8 && currentTime < p.deliveryTime + 0.1
    );
  }

  private logMessage(msg: P2PMessage): void {
    this.messageLog.unshift(msg);
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog.pop();
    }
  }

  public getRecentLogs(count = 20): P2PMessage[] {
    return this.messageLog.slice(0, count);
  }
}
