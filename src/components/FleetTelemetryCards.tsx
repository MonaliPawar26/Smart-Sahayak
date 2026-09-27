import React, { useState } from 'react';
import { AMRState, AMRTelemetry } from '../core/types';
import {
  Activity,
  Battery,
  BatteryCharging,
  Cpu,
  Navigation,
  Package,
  Shield,
  Zap,
  Radio,
  WifiOff,
  Table,
  Grid,
} from 'lucide-react';

interface FleetTelemetryCardsProps {
  robots: AMRTelemetry[];
  selectedRobotId?: string;
  onSelectRobot: (robotId: string) => void;
}

export const FleetTelemetryCards: React.FC<FleetTelemetryCardsProps> = ({
  robots,
  selectedRobotId,
  onSelectRobot,
}) => {
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  const selectedRobot = robots.find((r) => r.id === selectedRobotId) || robots[0];

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border-l border-slate-800 backdrop-blur-md overflow-hidden select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-200">
            FLEET STATUS & TELEMETRY
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('TABLE')}
            className={`p-1 rounded text-[10px] flex items-center gap-1 font-bold ${
              viewMode === 'TABLE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Compact Fleet Table View"
          >
            <Table className="w-3 h-3" />
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode('CARDS')}
            className={`p-1 rounded text-[10px] flex items-center gap-1 font-bold ${
              viewMode === 'CARDS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Detailed Edge Cards View"
          >
            <Grid className="w-3 h-3" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'TABLE' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Compact Fleet Table */}
          <div className="flex-1 overflow-y-auto p-1.5">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead>
                <tr className="text-slate-400 text-[10px] border-b border-slate-800 text-left bg-slate-950/80 sticky top-0">
                  <th className="py-1.5 px-2">ID</th>
                  <th className="py-1.5 px-2">STATE</th>
                  <th className="py-1.5 px-2">BATTERY</th>
                  <th className="py-1.5 px-2">TASK</th>
                  <th className="py-1.5 px-2">NETWORK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {robots.map((robot) => {
                  const isSelected = robot.id === selectedRobotId;
                  const isOffline = robot.state === AMRState.OFFLINE;

                  return (
                    <tr
                      key={robot.id}
                      onClick={() => onSelectRobot(robot.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-950/80 text-white font-bold'
                          : isOffline
                          ? 'bg-rose-950/30 text-rose-300 opacity-60'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <td className="py-1.5 px-2 font-bold flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: robot.color }}
                        />
                        <span>{robot.id}</span>
                      </td>

                      <td className="py-1.5 px-2">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded uppercase font-sans font-semibold ${
                            robot.isRFJammed
                              ? 'bg-purple-950 text-purple-300'
                              : isOffline
                              ? 'bg-rose-950 text-rose-300'
                              : robot.isYielding
                              ? 'bg-amber-950 text-amber-300'
                              : robot.state === AMRState.MOVING_TO_PICKUP || robot.state === AMRState.MOVING_TO_DROPOFF
                              ? 'bg-blue-950 text-blue-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {robot.isRFJammed ? 'JAMMED' : robot.isYielding ? 'YIELD' : robot.state.split('_')[0]}
                        </span>
                      </td>

                      <td className="py-1.5 px-2 font-bold">
                        <span
                          className={
                            robot.batteryPct < 20
                              ? 'text-rose-400'
                              : robot.batteryPct < 50
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {robot.batteryPct}%
                        </span>
                      </td>

                      <td className="py-1.5 px-2 truncate max-w-[80px]">
                        {robot.currentTask ? (
                          <span className="text-purple-300 font-bold">{robot.currentTask.id}</span>
                        ) : (
                          <span className="text-slate-500">&mdash;</span>
                        )}
                      </td>

                      <td className="py-1.5 px-2 text-[10px]">
                        {robot.edgeMetrics.isInDeadZone ? (
                          <span className="text-rose-400 font-bold">DEAD-ZONE</span>
                        ) : isOffline ? (
                          <span className="text-rose-500 font-bold">OFFLINE</span>
                        ) : (
                          <span className="text-emerald-400">Mesh OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selected Robot Inspector Drawer */}
          {selectedRobot && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 text-xs shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedRobot.color }} />
                  <span className="font-extrabold text-white text-xs">{selectedRobot.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">ID: {selectedRobot.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-500 text-[9px] block font-sans">Edge CPU</span>
                  <span className="font-bold text-blue-400">{selectedRobot.edgeMetrics.cpuUsagePct}%</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-500 text-[9px] block font-sans">A* Planning</span>
                  <span className="font-bold text-emerald-400">{selectedRobot.edgeMetrics.planningLatencyMs} ms</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-500 text-[9px] block font-sans">RAM Allocation</span>
                  <span className="font-bold text-purple-400">{selectedRobot.edgeMetrics.ramUsageMb} MB</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-500 text-[9px] block font-sans">P2P Signal</span>
                  <span className="font-bold text-cyan-400">{selectedRobot.edgeMetrics.rfSignalDb} dBm</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Cards View */
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {robots.map((robot) => {
            const isSelected = robot.id === selectedRobotId;

            return (
              <div
                key={robot.id}
                onClick={() => onSelectRobot(robot.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                    : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: robot.color }} />
                    <span className="font-bold text-xs text-white">{robot.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300">
                    {robot.state}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] mb-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Location</span>
                    <span className="text-slate-200">
                      ({robot.pos.x.toFixed(1)}, {robot.pos.y.toFixed(1)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Speed</span>
                    <span className="text-slate-200">{robot.velocity.speed.toFixed(1)} m/s</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Battery</span>
                    <span className={robot.batteryPct < 20 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {robot.batteryPct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Planning: {robot.edgeMetrics.planningLatencyMs}ms</span>
                  <span>CPU: {robot.edgeMetrics.cpuUsagePct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
