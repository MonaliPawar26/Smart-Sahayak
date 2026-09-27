import React from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  Box,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { CoordinationMode } from '../core/types';
import { SCENARIOS } from '../data/scenarioData';

interface NavbarProps {
  mode: CoordinationMode;
  setMode: (mode: CoordinationMode) => void;
  currentScenarioId?: string;
  onSelectScenario?: (scenarioId: string) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  simTime: number;
  activeRobotsCount: number;
  totalRobots: number;
  completedTasks: number;
  totalCollisions: number;
  activeDeadlocksCount: number;
  deadlocksResolved: number;
  totalReroutes: number;
  totalReassignments: number;
  speedupPct: number;
  isCloudOnline: boolean;
  onToggleCloud: () => void;
  onInjectRobotFailure: () => void;
  onOpenDemoFlow: () => void;
  onOpenBenchmark: () => void;
  onSpawnTask: () => void;
  onReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  setMode,
  currentScenarioId,
  onSelectScenario,
  isRunning,
  setIsRunning,
  simTime,
  activeRobotsCount,
  totalRobots,
  completedTasks,
  totalCollisions,
  activeDeadlocksCount,
  deadlocksResolved,
  totalReroutes,
  totalReassignments,
  speedupPct,
  isCloudOnline,
  onToggleCloud,
  onInjectRobotFailure,
  onOpenDemoFlow,
  onOpenBenchmark,
  onSpawnTask,
  onReset,
}) => {
  return (
    <header className="bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 py-2 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Organization Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white tracking-wider text-sm flex items-center gap-1.5">
              SMART <span className="text-blue-400">SAHAYAK</span> CORE
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wide bg-blue-900/60 border border-blue-500/40 text-blue-300 rounded">
              EDGE-AI MULTI-AMR FLEET
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Decentralized Autonomous Fleet Coordination Digital Twin
          </p>
        </div>

        {/* Scenario Selector Dropdown */}
        {onSelectScenario && (
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg text-xs ml-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scenario:</span>
            <select
              value={currentScenarioId || 'S04'}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="bg-slate-900 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/40 focus:outline-none cursor-pointer hover:border-blue-400 transition-colors text-xs"
            >
              {SCENARIOS.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Real-Time Telemetry Counter Bar */}
      <div className="hidden xl:flex items-center gap-1.5 font-mono text-xs">
        {/* Active Fleet */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-slate-200">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>
            <strong className="text-white font-bold">{activeRobotsCount}</strong>/{totalRobots} AMRs
          </span>
        </div>

        {/* Orders Delivered */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-slate-200">
          <Box className="w-3.5 h-3.5 text-amber-400" />
          <span>
            <strong className="text-white font-bold">{completedTasks}</strong> Delivered
          </span>
        </div>

        {/* Zero Collisions */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold">
            {totalCollisions === 0 ? '0 Collisions' : `${totalCollisions} Collisions`}
          </span>
        </div>

        {/* Deadlocks (Active & Resolved) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/40 text-purple-200">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span>
            Active: <strong className="text-emerald-400">{activeDeadlocksCount}</strong> | Cleared:{' '}
            <strong className="text-purple-300">{deadlocksResolved}</strong>
          </span>
        </div>

        {/* Reroutes & Reassignments */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-slate-300">
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Reroutes: <strong className="text-cyan-300">{totalReroutes}</strong> | Reassign:{' '}
            <strong className="text-amber-300">{totalReassignments}</strong>
          </span>
        </div>

        {/* Benchmark Speedup Badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-500/50 text-blue-300 font-bold">
          <Award className="w-3.5 h-3.5 text-amber-300" />
          <span>+{speedupPct.toFixed(1)}% Faster</span>
        </div>

        {/* Sim Clock */}
        <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-blue-400 font-bold">
          {simTime.toFixed(1)}s
        </div>
      </div>

      {/* Action Controls & Toggles */}
      <div className="flex items-center gap-1.5 text-xs">
        {/* Cloud Link ON / OFF Toggle */}
        <button
          onClick={onToggleCloud}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all ${
            isCloudOnline
              ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
              : 'bg-rose-950/90 text-rose-200 border border-rose-500/60 shadow-md shadow-rose-900/40'
          }`}
          title="Toggle Cloud Link ON/OFF to test Wi-Fi blackout resilience"
        >
          {isCloudOnline ? <Wifi className="w-3.5 h-3.5 text-blue-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
          <span>CLOUD: {isCloudOnline ? 'ON' : 'OFFLINE'}</span>
        </button>

        {/* Inject Robot Failure Button */}
        <button
          onClick={onInjectRobotFailure}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-200 transition-colors"
          title="Inject hardware failure into an active AMR"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Failure Inject</span>
        </button>

        {/* SIH Presentation Demo Stepper Modal */}
        <button
          onClick={onOpenDemoFlow}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
          title="Open SIH Presentation 8-Step Demo Flow"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Demo Flow</span>
        </button>

        {/* Benchmark Button */}
        <button
          onClick={onOpenBenchmark}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
        >
          <Award className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Benchmark</span>
        </button>

        {/* Pause/Resume */}
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`p-1.5 rounded-lg text-white font-semibold transition-all ${
            isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
          title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
