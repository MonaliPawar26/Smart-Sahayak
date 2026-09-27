import { Position2D, TaskAnnounceMessage, TaskAwardMessage, TaskBidMessage, WarehouseTask } from './types';
import { P2PNetwork } from './P2PNetwork';

export interface ActiveAuction {
  task: WarehouseTask;
  announceTime: number;
  deadline: number;
  initiatorRobotId: string;
  bids: Map<string, { bidCost: number; estimatedEtaSec: number; batteryLevel: number }>;
  awarded: boolean;
}

export class ContractNetAllocator {
  private network: P2PNetwork;
  private activeAuctions: Map<string, ActiveAuction> = new Map();
  public auctionTimeoutMs: number = 100; // Instant 100ms P2P negotiation window
  public totalAuctionsHeld: number = 0;
  public totalTasksAwarded: number = 0;

  constructor(network: P2PNetwork) {
    this.network = network;
  }

  /**
   * Announce a new warehouse transport task to the P2P fleet
   */
  public announceTask(initiatorRobotId: string, task: WarehouseTask, currentTime: number): void {
    const auction: ActiveAuction = {
      task,
      announceTime: currentTime,
      deadline: currentTime + this.auctionTimeoutMs / 1000,
      initiatorRobotId,
      bids: new Map(),
      awarded: false,
    };

    this.activeAuctions.set(task.id, auction);
    this.totalAuctionsHeld++;

    const msg: TaskAnnounceMessage = {
      id: `announce-${task.id}-${Date.now()}`,
      type: 'TASK_ANNOUNCE',
      senderId: initiatorRobotId,
      senderPos: task.pickup,
      task,
      timestamp: currentTime,
      ttl: 3,
    };

    this.network.broadcast(initiatorRobotId, msg, currentTime);
  }

  /**
   * Submit a bid for an active task
   */
  public submitBid(robotId: string, robotPos: Position2D, taskId: string, bidCost: number, etaSec: number, battery: number, currentTime: number): void {
    const auction = this.activeAuctions.get(taskId);
    if (!auction || auction.awarded) return;

    auction.bids.set(robotId, { bidCost, estimatedEtaSec: etaSec, batteryLevel: battery });

    const bidMsg: TaskBidMessage = {
      id: `bid-${taskId}-${robotId}-${Date.now()}`,
      type: 'TASK_BID',
      senderId: robotId,
      senderPos: robotPos,
      taskId,
      bidCost,
      estimatedEtaSec: etaSec,
      batteryLevel: battery,
      timestamp: currentTime,
      ttl: 3,
    };

    this.network.broadcast(robotId, bidMsg, currentTime);
  }

  /**
   * Evaluate open auctions and award to best idle bidder
   */
  public step(
    currentTime: number,
    isRobotAvailable: (robotId: string) => boolean,
    onTaskAwarded: (taskId: string, winnerRobotId: string) => void
  ): void {
    const awardedInThisRound = new Set<string>();

    for (const [taskId, auction] of this.activeAuctions.entries()) {
      if (!auction.awarded && currentTime >= auction.deadline) {
        // Evaluate bids from available robots
        let bestBidderId: string | null = null;
        let lowestCost = Infinity;

        for (const [bidderId, bidData] of auction.bids.entries()) {
          if (isRobotAvailable(bidderId) && !awardedInThisRound.has(bidderId)) {
            if (bidData.bidCost < lowestCost) {
              lowestCost = bidData.bidCost;
              bestBidderId = bidderId;
            }
          }
        }

        if (bestBidderId) {
          auction.awarded = true;
          this.totalTasksAwarded++;
          awardedInThisRound.add(bestBidderId);

          const awardMsg: TaskAwardMessage = {
            id: `award-${taskId}-${bestBidderId}-${Date.now()}`,
            type: 'TASK_AWARD',
            senderId: auction.initiatorRobotId,
            senderPos: auction.task.pickup,
            taskId,
            winnerRobotId: bestBidderId,
            timestamp: currentTime,
            ttl: 3,
          };

          this.network.broadcast(auction.initiatorRobotId, awardMsg, currentTime);
          onTaskAwarded(taskId, bestBidderId);
        } else {
          // No available bidders currently, retry in 0.3s
          auction.deadline = currentTime + 0.3;
        }
      }
    }
  }

  public isAuctionActive(taskId: string): boolean {
    const auction = this.activeAuctions.get(taskId);
    return !!auction && !auction.awarded;
  }

  public getActiveAuctionCount(): number {
    return Array.from(this.activeAuctions.values()).filter((a) => !a.awarded).length;
  }
}
