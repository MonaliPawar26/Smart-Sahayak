import React from 'react';
import { TaskReassignmentRecord, WarehouseTask } from '../core/types';
import { Box, CheckCircle2, Clock, RefreshCw, Truck } from 'lucide-react';

interface TaskPanelProps {
  tasks: WarehouseTask[];
  completedCount: number;
  reassignments: TaskReassignmentRecord[];
  onSpawnTask: () => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  tasks,
  completedCount,
  reassignments,
  onSpawnTask,
}) => {
  const activeTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden text-xs select-none">
      {/* Header */}
      <div className="bg-slate-900/90 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-purple-400" />
          <h3 className="font-extrabold text-slate-200 text-xs">SMART WAREHOUSE PICKING TASKS</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">
            Active: <strong className="text-purple-300 font-bold">{activeTasks.length}</strong>
          </span>
          <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
            Completed: {completedCount}
          </span>
          <button
            onClick={onSpawnTask}
            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[10px] transition-colors"
          >
            + Spawn Task
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/60 font-mono text-[11px]">
        {activeTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-6 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-purple-400/60" />
            <span>ALL WAREHOUSE TASKS COMPLETED</span>
            <button onClick={onSpawnTask} className="text-purple-400 hover:underline text-[10px] mt-1">
              Click to spawn new pick orders
            </button>
          </div>
        ) : (
          activeTasks.map((t) => {
            const isReassigned = reassignments.some((r) => r.taskId === t.id);

            return (
              <div
                key={t.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-2.5 rounded-lg space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Box className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t.id}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({t.sku})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isReassigned && (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800/80 text-[9px] px-1.5 py-0.2 rounded font-mono flex items-center gap-0.5">
                        <RefreshCw className="w-2.5 h-2.5" /> REASSIGNED
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        t.status === 'IN_PROGRESS'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-1.5 rounded border border-slate-800/60 text-slate-300">
                  <div>
                    <span className="text-slate-500">Pickup:</span> ({t.pickup.x}, {t.pickup.y})
                  </div>
                  <div>
                    <span className="text-slate-500">Drop:</span> ({t.dropoff.x}, {t.dropoff.y})
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Truck className="w-3 h-3 text-cyan-400" />
                    Assigned:{' '}
                    <strong className="text-cyan-300">
                      {t.assignedRobotId || 'AUCTION IN PROGRESS...'}
                    </strong>
                  </span>
                  <span>
                    Priority: <strong className="text-amber-400">{t.priority}</strong> (
                    {t.weightKg}kg)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
