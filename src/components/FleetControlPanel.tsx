import React from 'react';
import {
  CoordinationMode,
  WarehousePresetScenario,
} from '../core/types';
import {
  Cpu,
  Layers,
  Sliders,
  Sparkles,
  Zap,
  Radio,
  Clock,
  ShieldAlert,
  HelpCircle,
  Truck,
  RotateCcw,
  Users,
  Box,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface FleetControlPanelProps {
  mode: CoordinationMode;
  setMode: (mode: CoordinationMode) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  robotCount: number;
  setRobotCount: (count: number) => void;
  onLoadScenario: (scenarioId: string) => void;
  onSpawnTask: () => void;
  onSpawnHumanWorker?: () => void;
  onSpawnForklift?: () => void;
  onSpawnHeavyTandem?: () => void;
  onOpenReport?: () => void;
}

export const FleetControlPanel: React.FC<FleetControlPanelProps> = ({
  mode,
  setMode,
  speed,
  setSpeed,
  robotCount,
  setRobotCount,
  onLoadScenario,
  onSpawnTask,
  onSpawnHumanWorker,
  onSpawnForklift,
  onSpawnHeavyTandem,
  onOpenReport,
}) => {
  const scenarios = [
    {
      id: 'default',
      name: 'Standard Shift',
      desc: 'Uniform picking & replenishment orders',
      icon: '📦',
    },
    {
      id: 'head_on_deadlock',
      name: '1-Lane Aisle Head-On',
      desc: '2 AMRs meeting head-on; Backtrack-to-Bay',
      icon: '⚔️',
    },
    {
      id: 'intersection_stress',
      name: '4-Way Intersection',
      desc: 'Cross-traffic right-of-way resolution',
      icon: '🚦',
    },
    {
      id: 'deadzone_blackout',
      name: 'Dead-Zone & Blocked Aisle',
      desc: 'Obstacle in RF shadow; local gossip re-routing',
      icon: '📡',
    },
  ];

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 backdrop-blur-md p-3 z-20 select-none">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center max-w-7xl mx-auto">
        {/* Coordination Mode Selector Tabs */}
        <div className="md:col-span-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1 px-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>COORDINATION ARCHITECTURE</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setMode(CoordinationMode.DECENTRALIZED_EDGE)}
              className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                mode === CoordinationMode.DECENTRALIZED_EDGE
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-center gap-0.5">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Edge P2P</span>
              </div>
            </button>

            <button
              onClick={() => setMode(CoordinationMode.TRADITIONAL_STOP_AND_WAIT)}
              className={`px-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                mode === CoordinationMode.TRADITIONAL_STOP_AND_WAIT
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 border border-amber-400/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Stop & Wait</span>
            </button>

            <button
              onClick={() => setMode(CoordinationMode.CENTRALIZED_CLOUD)}
              className={`px-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-center ${
                mode === CoordinationMode.CENTRALIZED_CLOUD
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-400/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Cloud</span>
            </button>
          </div>
        </div>

        {/* Preset Scenarios */}
        <div className="md:col-span-4 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1 px-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>TEST STRESS SCENARIOS</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                onClick={() => onLoadScenario(sc.id)}
                className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-left transition-colors group"
                title={sc.desc}
              >
                <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1 truncate">
                  <span>{sc.icon}</span>
                  <span className="truncate">{sc.name.split(' ')[0]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Unique Feature Injection Actions */}
        <div className="md:col-span-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1 px-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>UNIQUE EDGE-AI INJECTIONS</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <button
              onClick={onSpawnHumanWorker}
              className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md font-semibold text-amber-300 flex items-center justify-center gap-1 transition-colors"
              title="Spawn dynamic human worker (LiDAR safety zone test)"
            >
              <Users className="w-3 h-3" />
              <span>+ Worker</span>
            </button>

            <button
              onClick={onSpawnHeavyTandem}
              className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md font-semibold text-orange-300 flex items-center justify-center gap-1 transition-colors"
              title="Spawn 500kg Heavy Tandem Dual-AMR transport"
            >
              <Box className="w-3 h-3" />
              <span>+ Tandem</span>
            </button>

            <button
              onClick={onOpenReport}
              className="p-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 rounded-md font-bold text-indigo-200 flex items-center justify-center gap-1 transition-colors"
              title="Export BEL Fleet Mission Audit Report"
            >
              <FileText className="w-3 h-3 text-indigo-400" />
              <span>Audit Log</span>
            </button>
          </div>
        </div>

        {/* Speed & Sizing */}
        <div className="md:col-span-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-400" /> Speed:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                    speed === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Truck className="w-3 h-3 text-emerald-400" /> Fleet:
            </span>
            <div className="flex items-center gap-0.5">
              {[3, 4, 6, 8].map((c) => (
                <button
                  key={c}
                  onClick={() => setRobotCount(c)}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                    robotCount === c ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
