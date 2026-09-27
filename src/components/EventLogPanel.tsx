import React, { useState } from 'react';
import { EventLogEntry } from '../core/types';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Info,
  Radio,
  Shield,
  Truck,
  Zap,
} from 'lucide-react';

interface EventLogPanelProps {
  logs: EventLogEntry[];
  onClearLogs?: () => void;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ logs, onClearLogs }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (selectedCategory === 'ALL') return true;
    return log.category === selectedCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'COMMUNICATION':
        return <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">P2P</span>;
      case 'SAFETY':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">SAFETY</span>;
      case 'PLANNING':
        return <span className="bg-blue-950 text-blue-300 border border-blue-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">A* PLAN</span>;
      case 'TASK':
        return <span className="bg-purple-950 text-purple-300 border border-purple-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">TASK</span>;
      case 'ROBOT':
        return <span className="bg-rose-950 text-rose-300 border border-rose-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">ROBOT</span>;
      case 'BENCHMARK':
        return <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[9px] font-mono px-1.5 py-0.5 rounded">BENCH</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 text-[9px] font-mono px-1.5 py-0.5 rounded">SYSTEM</span>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'ALERT':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'WARN':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'SUCCESS':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden text-xs">
      {/* Header & Category Filters */}
      <div className="bg-slate-900/90 px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>SIMULATION EVENT LOG STREAM</span>
          <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {filteredLogs.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-semibold">
          {['ALL', 'SAFETY', 'PLANNING', 'TASK', 'ROBOT', 'COMMUNICATION', 'BENCHMARK'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px] bg-slate-950/60">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 py-6 text-[11px]">
            No simulation events logged for category &ldquo;{selectedCategory}&rdquo;.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/50 p-1.5 rounded-lg transition-colors"
            >
              <span className="text-slate-500 text-[10px] shrink-0 font-mono mt-0.5">
                {log.clockTime}
              </span>
              {getSeverityIcon(log.severity)}
              {getCategoryBadge(log.category)}
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-200 mr-1.5">{log.title}:</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
