import React from 'react';
import { P2PMessage } from '../core/types';
import { MeshLink } from '../core/P2PNetwork';
import {
  Radio,
  Share2,
  Terminal,
  Activity,
  Zap,
  ArrowRight,
  ShieldCheck,
  Send,
} from 'lucide-react';

interface P2PMeshInspectorProps {
  logs: P2PMessage[];
  activeLinks: MeshLink[];
}

export const P2PMeshInspector: React.FC<P2PMeshInspectorProps> = ({
  logs,
  activeLinks,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-950/90 border-t border-slate-800 backdrop-blur-md overflow-hidden select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
            Decentralized P2P Mesh Protocol Stream
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            {activeLinks.length} Active RF Links
          </span>
        </div>
      </div>

      {/* Packet Stream Console */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-slate-950/90">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-4">
            Awaiting inter-robot P2P message traffic...
          </div>
        ) : (
          logs.slice(0, 15).map((msg, idx) => {
            let badgeBg = 'bg-slate-800 text-slate-300';
            let icon = <Send className="w-3 h-3 text-slate-400" />;

            if (msg.type === 'HEARTBEAT') {
              badgeBg = 'bg-blue-950 text-blue-300 border border-blue-500/30';
              icon = <Activity className="w-3 h-3 text-blue-400" />;
            } else if (msg.type === 'TRAJECTORY_INTENT') {
              badgeBg = 'bg-cyan-950 text-cyan-300 border border-cyan-500/30';
              icon = <Radio className="w-3 h-3 text-cyan-400" />;
            } else if (msg.type === 'DEADLOCK_YIELD') {
              badgeBg = 'bg-purple-950 text-purple-300 border border-purple-500/30';
              icon = <Zap className="w-3 h-3 text-purple-400" />;
            } else if (msg.type === 'TASK_BID' || msg.type === 'TASK_AWARD' || msg.type === 'TASK_ANNOUNCE') {
              badgeBg = 'bg-amber-950 text-amber-300 border border-amber-500/30';
              icon = <Share2 className="w-3 h-3 text-amber-400" />;
            } else if (msg.type === 'OBSTACLE_GOSSIP') {
              badgeBg = 'bg-red-950 text-red-300 border border-red-500/30';
              icon = <ShieldCheck className="w-3 h-3 text-red-400" />;
            }

            return (
              <div
                key={msg.id || idx}
                className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px]">
                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badgeBg} flex items-center gap-1`}>
                    {icon}
                    {msg.type}
                  </span>
                  <span className="font-semibold text-white">{msg.senderId}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                  <span className="text-slate-400">
                    {msg.targetId ? msg.targetId : 'Local RF Broadcast'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400">
                  {msg.type === 'TRAJECTORY_INTENT' && `Priority: ${(msg as any).priorityScore?.toFixed(1)}`}
                  {msg.type === 'HEARTBEAT' && `Bat: ${(msg as any).battery}% | Spd: ${(msg as any).speed?.toFixed(1)}m/s`}
                  {msg.type === 'TASK_BID' && `Bid: ${(msg as any).bidCost?.toFixed(1)} | ETA: ${(msg as any).estimatedEtaSec?.toFixed(1)}s`}
                  {msg.type === 'TASK_AWARD' && `Winner: ${(msg as any).winnerRobotId}`}
                  {msg.type === 'DEADLOCK_YIELD' && `Yielding to Bay (${(msg as any).bayCoord?.x}, ${(msg as any).bayCoord?.y})`}
                  {msg.type === 'OBSTACLE_GOSSIP' && `Blocked Aisle @ (${(msg as any).obstaclePos?.x}, ${(msg as any).obstaclePos?.y})`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
