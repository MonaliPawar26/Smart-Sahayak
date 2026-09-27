import React from 'react';
import { ConflictRecord } from '../core/types';
import { ShieldAlert, CheckCircle2, Zap, Clock } from 'lucide-react';

interface ConflictPanelProps {
  conflicts: ConflictRecord[];
  activeConflictCount: number;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({ conflicts, activeConflictCount }) => {
  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden text-xs select-none">
      {/* Header */}
      <div className="bg-slate-900/90 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="font-extrabold text-slate-200 text-xs">DYNAMIC CONFLICT RESOLUTION LOG</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">
            Active Conflicts:{' '}
            <strong className={activeConflictCount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {activeConflictCount}
            </strong>
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            Total Resolved: {conflicts.filter((c) => c.isResolved).length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/60 font-mono text-[11px]">
        {conflicts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
            <span>NO ACTIVE OR HISTORICAL CONFLICTS</span>
            <span className="text-[10px] text-slate-600">Zero inter-robot spatial overlap detected</span>
          </div>
        ) : (
          conflicts.map((c) => (
            <div
              key={c.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-2.5 rounded-lg space-y-1.5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Conflict {c.id.slice(-6)}: {c.robotA} &harr; {c.robotB}
                  </span>
                </div>
                <span className="bg-slate-800 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {c.zone}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-2 rounded border border-slate-800/60 text-slate-300">
                <div>
                  <span className="text-slate-500">Winner:</span>{' '}
                  <strong className="text-emerald-400">{c.winnerId}</strong> (P: {c.winnerPriority})
                </div>
                <div>
                  <span className="text-slate-500">Yielding:</span>{' '}
                  <strong className="text-amber-400">{c.loserId}</strong> (P: {c.loserPriority})
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate">
                  Reason: <span className="text-slate-300">{c.reason}</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold shrink-0 ml-2">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {c.resolutionTimeMs} ms
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
