import React, { useState, useEffect, useRef } from 'react';
import { SimulationEngine } from './core/SimulationEngine';
import {
  CoordinationMode,
  AMRTelemetry,
  WarehouseTask,
  P2PMessage,
  HumanWorker,
  CollaborativeTandem,
  ConflictRecord,
  EventLogEntry,
  TaskReassignmentRecord,
} from './core/types';
import { MeshLink, InFlightPacket } from './core/P2PNetwork';
import { Navbar } from './components/Navbar';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { FleetControlPanel } from './components/FleetControlPanel';
import { FleetTelemetryCards } from './components/FleetTelemetryCards';
import { P2PMeshInspector } from './components/P2PMeshInspector';
import { BenchmarkComparisonModal } from './components/BenchmarkComparisonModal';
import { MissionReportModal } from './components/MissionReportModal';
import { DemoFlowModal } from './components/DemoFlowModal';
import { ConflictPanel } from './components/ConflictPanel';
import { TaskPanel } from './components/TaskPanel';
import { EventLogPanel } from './components/EventLogPanel';
import { soundFx } from './utils/AudioSynthesizer';

export const App: React.FC = () => {
  // Initialize Core Simulation Engine
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine();
  }
  const engine = engineRef.current;

  // React states synchronized from simulation
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [mode, setMode] = useState<CoordinationMode>(CoordinationMode.DECENTRALIZED_EDGE);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [robotCount, setRobotCount] = useState<number>(8);
  const [simTime, setSimTime] = useState<number>(0);
  const [isCloudOnline, setIsCloudOnline] = useState<boolean>(true);
  const [currentScenarioId, setCurrentScenarioId] = useState<string>('S04');

  const handleSelectScenario = (scenarioId: string) => {
    setCurrentScenarioId(scenarioId);
    engine.loadScenario(scenarioId);
    setRobotCount(engine.robots.length);
    setActiveRobotsCount(engine.robots.length);
    setSelectedRobotId(undefined);
  };

  const [robots, setRobots] = useState<AMRTelemetry[]>([]);
  const [activeRobotsCount, setActiveRobotsCount] = useState<number>(8);
  const [tasks, setTasks] = useState<WarehouseTask[]>([]);
  const [humans, setHumans] = useState<HumanWorker[]>([]);
  const [tandems, setTandems] = useState<CollaborativeTandem[]>([]);
  const [completedTasksCount, setCompletedTasksCount] = useState<number>(0);
  const [totalCollisions, setTotalCollisions] = useState<number>(0);
  const [deadlocksResolved, setDeadlocksResolved] = useState<number>(0);
  const [totalReroutes, setTotalReroutes] = useState<number>(0);
  const [totalReassignments, setTotalReassignments] = useState<number>(0);
  const [speedupPct, setSpeedupPct] = useState<number>(46.7);

  const [activeMeshLinks, setActiveMeshLinks] = useState<MeshLink[]>([]);
  const [inFlightPackets, setInFlightPackets] = useState<InFlightPacket[]>([]);
  const [messageLogs, setMessageLogs] = useState<P2PMessage[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLogEntry[]>([]);
  const [conflictRecords, setConflictRecords] = useState<ConflictRecord[]>([]);
  const [reassignments, setReassignments] = useState<TaskReassignmentRecord[]>([]);

  const [selectedRobotId, setSelectedRobotId] = useState<string | undefined>(undefined);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isDemoFlowOpen, setIsDemoFlowOpen] = useState<boolean>(false);
  const [activeBottomTab, setActiveBottomTab] = useState<
    'CONTROLS' | 'MESH_INSPECTOR' | 'CONFLICTS' | 'TASKS' | 'EVENTS'
  >('CONTROLS');

  // Sync mode changes with simulation engine
  const handleSetMode = (newMode: CoordinationMode) => {
    setMode(newMode);
    engine.setMode(newMode);
  };

  const handleSetSpeed = (newSpeed: number) => {
    setSimSpeed(newSpeed);
    engine.simSpeedMultiplier = newSpeed;
  };

  const handleSetRobotCount = (count: number) => {
    setRobotCount(count);
    engine.initFleet(count);
  };

  const handleLoadScenario = (scenarioId: string) => {
    engine.loadScenario(scenarioId);
    setRobotCount(engine.targetRobotCount);
    setIsRunning(true);
    soundFx.playDeadlockResolveBeep();
  };

  const handleSpawnTask = () => {
    engine.spawnTask(3);
    soundFx.playArrivalChime();
  };

  const handleSpawnHumanWorker = () => {
    engine.spawnHumanWorker('HUMAN_WORKER');
    soundFx.playHumanWarningHorn();
  };

  const handleSpawnForklift = () => {
    engine.spawnHumanWorker('MANUAL_FORKLIFT');
    soundFx.playHumanWarningHorn();
  };

  const handleSpawnHeavyTandem = () => {
    engine.spawnHeavyTandemTask();
    soundFx.playArrivalChime();
  };

  const handleToggleRFJammer = (gx: number, gy: number) => {
    engine.map.toggleRFJammer(gx, gy);
  };

  const handleToggleCloud = () => {
    const online = engine.toggleCloudLink();
    setIsCloudOnline(online);
  };

  const handleInjectRobotFailure = () => {
    const failedId = engine.injectRobotFailure();
    if (failedId) {
      soundFx.playCyberJamAlert();
    }
  };

  const handleReset = () => {
    engine.initFleet(robotCount);
    engine.tasks = [];
    engine.completedTasks = [];
    engine.humans = [];
    engine.initDefaultHumans();
    engine.collaborativeTandems = [];
    engine.map.rfJammers = [];
    engine.totalCollisionsDetected = 0;
    engine.simulationTime = 0;
    setIsCloudOnline(true);
    engine.isCloudOnline = true;
  };

  const handleToggleObstacle = (gx: number, gy: number) => {
    const isNowBlocked = engine.map.toggleDynamicObstacle(gx, gy);
    engine.totalReroutes++;
    engine.logEvent(
      'PLANNING',
      isNowBlocked ? 'AISLE BLOCKED' : 'AISLE CLEARED',
      `Obstacle ${isNowBlocked ? 'dropped' : 'removed'} at (${gx}, ${gy}). Local A* replanning triggered.`,
      isNowBlocked ? 'WARN' : 'INFO'
    );

    if (engine.mode === CoordinationMode.DECENTRALIZED_EDGE && engine.robots.length > 0) {
      engine.robots[0].broadcastObstacleDiscovered({ x: gx, y: gy });
      for (const r of engine.robots) {
        r.replanCurrentMission(engine.simulationTime);
      }
    }
  };

  // Run SIH presentation demo step
  const handleRunDemoStep = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        engine.initFleet(8);
        setMode(CoordinationMode.DECENTRALIZED_EDGE);
        setIsRunning(true);
        break;
      case 2:
        setIsRunning(true);
        for (let i = 0; i < 3; i++) engine.spawnTask();
        break;
      case 3:
        engine.loadScenario('narrow_intersection');
        setIsRunning(true);
        setActiveBottomTab('CONFLICTS');
        break;
      case 4:
        engine.loadScenario('blocked_aisle');
        setIsRunning(true);
        setActiveBottomTab('EVENTS');
        break;
      case 5:
        engine.injectRobotFailure('R03');
        setActiveBottomTab('TASKS');
        break;
      case 6:
        engine.toggleCloudLink();
        setIsCloudOnline(false);
        setActiveBottomTab('EVENTS');
        break;
      case 7:
        engine.loadScenario('deadlock');
        setIsRunning(true);
        setActiveBottomTab('CONFLICTS');
        break;
      case 8:
        setIsBenchmarkModalOpen(true);
        break;
    }
  };

  // Main high-performance simulation tick loop (30 FPS React sync)
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      if (isRunning && deltaSec > 0 && deltaSec < 0.5) {
        engine.step(deltaSec);
      }

      // Sync state to React
      const snapshot = engine.getTelemetrySnapshot();
      setRobots(snapshot.robots);
      setActiveRobotsCount(snapshot.activeRobotsCount);
      setTasks(snapshot.tasks);
      setHumans(snapshot.humans);
      setTandems(snapshot.collaborativeTandems);
      setCompletedTasksCount(snapshot.completedTasksCount);
      setSimTime(snapshot.simulationTime);
      setIsCloudOnline(snapshot.isCloudOnline);
      setTotalCollisions(snapshot.totalCollisions);
      setDeadlocksResolved(snapshot.deadlocksResolved);
      setTotalReroutes(snapshot.totalReroutes);
      setTotalReassignments(snapshot.totalTaskReassignments);
      setSpeedupPct(snapshot.makespanSpeedupPct);

      setActiveMeshLinks([...engine.network.activeLinks]);
      setInFlightPackets([...engine.network.inFlightPackets]);
      setMessageLogs([...engine.network.getRecentLogs(20)]);
      setEventLogs([...snapshot.eventLogs]);
      setReassignments([...snapshot.taskReassignments]);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, engine]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080C14] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Industrial Navbar with Full KPI Bar */}
      <Navbar
        mode={mode}
        setMode={handleSetMode}
        currentScenarioId={currentScenarioId}
        onSelectScenario={handleSelectScenario}
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        simTime={simTime}
        activeRobotsCount={activeRobotsCount}
        totalRobots={robotCount}
        completedTasks={completedTasksCount}
        totalCollisions={totalCollisions}
        activeDeadlocksCount={0}
        deadlocksResolved={deadlocksResolved}
        totalReroutes={totalReroutes}
        totalReassignments={totalReassignments}
        speedupPct={speedupPct}
        isCloudOnline={isCloudOnline}
        onToggleCloud={handleToggleCloud}
        onInjectRobotFailure={handleInjectRobotFailure}
        onOpenDemoFlow={() => setIsDemoFlowOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
        onSpawnTask={handleSpawnTask}
        onReset={handleReset}
      />

      {/* Main Viewport: Canvas + Telemetry Sidebar */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Center: Interactive 2D/3D Warehouse Canvas & Panels */}
        <div className="flex-1 flex flex-col relative h-full overflow-hidden">
          <div className="flex-1 relative">
            <WarehouseCanvas
              map={engine.map}
              robots={robots}
              tasks={tasks}
              humans={humans}
              tandems={tandems}
              activeMeshLinks={activeMeshLinks}
              inFlightPackets={inFlightPackets}
              selectedRobotId={selectedRobotId}
              onSelectRobot={(id) => setSelectedRobotId(id)}
              onToggleObstacle={handleToggleObstacle}
              onToggleRFJammer={handleToggleRFJammer}
            />
          </div>

          {/* Bottom Navigation Tabs */}
          <div className="bg-slate-900/90 border-t border-slate-800 flex items-center justify-between px-3 py-1 text-[11px] shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveBottomTab('CONTROLS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeBottomTab === 'CONTROLS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fleet Controls
              </button>
              <button
                onClick={() => setActiveBottomTab('MESH_INSPECTOR')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeBottomTab === 'MESH_INSPECTOR' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                P2P Packets
              </button>
              <button
                onClick={() => setActiveBottomTab('CONFLICTS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeBottomTab === 'CONFLICTS' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Conflicts
              </button>
              <button
                onClick={() => setActiveBottomTab('TASKS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeBottomTab === 'TASKS' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Task Allocations
              </button>
              <button
                onClick={() => setActiveBottomTab('EVENTS')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                  activeBottomTab === 'EVENTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Event Stream</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </button>
            </div>

            <div className="hidden sm:block text-slate-400 font-mono text-[10px]">
              Coordination: <strong className="text-blue-400">{mode}</strong>
            </div>
          </div>

          {/* Bottom Drawer Active Component */}
          <div className="h-36 sm:h-40 shrink-0">
            {activeBottomTab === 'CONTROLS' && (
              <FleetControlPanel
                mode={mode}
                setMode={handleSetMode}
                speed={simSpeed}
                setSpeed={handleSetSpeed}
                robotCount={robotCount}
                setRobotCount={handleSetRobotCount}
                onLoadScenario={handleLoadScenario}
                onSpawnTask={handleSpawnTask}
                onSpawnHumanWorker={handleSpawnHumanWorker}
                onSpawnForklift={handleSpawnForklift}
                onSpawnHeavyTandem={handleSpawnHeavyTandem}
                onOpenReport={() => setIsReportModalOpen(true)}
              />
            )}
            {activeBottomTab === 'MESH_INSPECTOR' && (
              <P2PMeshInspector logs={messageLogs} activeLinks={activeMeshLinks} />
            )}
            {activeBottomTab === 'CONFLICTS' && (
              <ConflictPanel conflicts={conflictRecords} activeConflictCount={0} />
            )}
            {activeBottomTab === 'TASKS' && (
              <TaskPanel
                tasks={tasks}
                completedCount={completedTasksCount}
                reassignments={reassignments}
                onSpawnTask={handleSpawnTask}
              />
            )}
            {activeBottomTab === 'EVENTS' && (
              <EventLogPanel logs={eventLogs} />
            )}
          </div>
        </div>

        {/* Right Sidebar: Compact Fleet Status Table & Inspector */}
        <div className="w-80 md:w-96 h-full shrink-0 hidden md:block">
          <FleetTelemetryCards
            robots={robots}
            selectedRobotId={selectedRobotId}
            onSelectRobot={(id) => setSelectedRobotId(id)}
          />
        </div>
      </div>

      {/* Smart Sahayak System Footer Status Bar */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SMART SAHAYAK CORE v2.0
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 hidden sm:inline">
            Bharat Electronics Limited (BEL PS 26123)
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-slate-400 text-[10px]">
          <span>Architecture: <strong className="text-blue-400">100% Edge-AI P2P Mesh</strong></span>
          <span>•</span>
          <span>Broadcasting: <strong className="text-cyan-400">10 Hz UDP Multicast</strong></span>
          <span>•</span>
          <span>Safety Envelope: <strong className="text-emerald-400">1.60m Bubble (0 Collisions)</strong></span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
            SYSTEM STATUS: OPERATIONAL
          </span>
          <span className="text-slate-500 font-bold hidden md:inline">
            T = {simTime.toFixed(1)}s
          </span>
        </div>
      </footer>

      {/* SIH Presentation Demo Stepper Modal */}
      <DemoFlowModal
        isOpen={isDemoFlowOpen}
        onClose={() => setIsDemoFlowOpen(false)}
        onRunStep={handleRunDemoStep}
      />

      {/* BEL Benchmark & Verification Modal */}
      <BenchmarkComparisonModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />

      {/* BEL Audit Report & Telemetry Log Modal */}
      <MissionReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        robots={robots}
        tasks={tasks}
        simTime={simTime}
        totalCollisions={totalCollisions}
        deadlocksResolved={deadlocksResolved}
      />
    </div>
  );
};
export default App;
