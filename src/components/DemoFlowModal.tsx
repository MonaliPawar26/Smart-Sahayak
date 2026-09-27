import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Layers,
  Play,
  Shield,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

interface DemoFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunStep: (stepNumber: number) => void;
}

export const DemoFlowModal: React.FC<DemoFlowModalProps> = ({ isOpen, onClose, onRunStep }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  if (!isOpen) return null;

  const demoSteps = [
    {
      step: 1,
      title: 'Initial Fleet Setup (8 AMRs)',
      icon: '🤖',
      description: 'Start simulation with 8 AMRs operating under Edge P2P mode.',
      expected: '8 AMRs Online, 0 Collisions, 0 Active Deadlocks.',
      actionLabel: 'Execute Step 1: Init Fleet',
    },
    {
      step: 2,
      title: 'Normal Fleet Picking Movement',
      icon: '📦',
      description: 'AMRs autonomously pick up & deliver tasks using Space-Time A* and P2P CNP auctions.',
      expected: 'Continuous flow, high throughput, zero collisions.',
      actionLabel: 'Execute Step 2: Continuous Flow',
    },
    {
      step: 3,
      title: 'Narrow Corridor Intersection Stress Test',
      icon: '⚔️',
      description: 'Robots approach narrow intersection simultaneously.',
      expected: 'CONFLICT_WARNING broadcast -> Priority Evaluation -> Yield -> 0 Collisions.',
      actionLabel: 'Execute Step 3: Trigger Intersection Test',
    },
    {
      step: 4,
      title: 'Blocked Aisle & Local Replanning',
      icon: '🚧',
      description: 'Drop dynamic obstacle in active route of AMR-03.',
      expected: 'Path marked INVALID -> P2P Gossip -> Local A* replan -> Alternative route.',
      actionLabel: 'Execute Step 4: Inject Blocked Aisle',
    },
    {
      step: 5,
      title: 'Robot Failure & Task Reassignment',
      icon: '💥',
      description: 'Inject hardware failure into AMR-03 mid-mission.',
      expected: 'AMR-03 OFFLINE (8 -> 7 Fleet) -> Task released -> Reassigned to nearest AMR.',
      actionLabel: 'Execute Step 5: Inject Robot Failure',
    },
    {
      step: 6,
      title: 'Cloud OFF / RF Shadow Resilience',
      icon: '📡',
      description: 'Toggle Cloud Link OFF to simulate Wi-Fi blackout.',
      expected: 'Cloud OFFLINE, P2P Mesh ONLINE, Local Planning ACTIVE -> Fleet continues operating!',
      actionLabel: 'Execute Step 6: Toggle Cloud Link OFF',
    },
    {
      step: 7,
      title: 'Deadlock Detection & Backtrack-to-Bay',
      icon: '🔄',
      description: 'Trigger 1-lane corridor head-on deadlock.',
      expected: 'Deadlock Detector finds circular wait -> Lower priority AMR yields into Bypass Bay.',
      actionLabel: 'Execute Step 7: Trigger Deadlock Test',
    },
    {
      step: 8,
      title: 'Headless Comparative Benchmark Suite',
      icon: '🏆',
      description: 'Run Stop-and-Wait vs Decentralized Edge under identical tasks & seeds.',
      expected: 'Calculated Makespan speedup >= 20% (Zero hardcoded numbers).',
      actionLabel: 'Execute Step 8: Open Comparative Benchmark',
    },
  ];

  const stepData = demoSteps[currentStep - 1];

  const handleNext = () => {
    if (currentStep < demoSteps.length) {
      const next = currentStep + 1;
      setCurrentStep(next);
      onRunStep(next);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      onRunStep(prev);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-sm">
                BEL AMR-EDGE — SIH Presentation Demo Stepper
              </h2>
              <p className="text-xs text-slate-400">
                Guided 8-Step Verification Flow for Problem Statement 26123
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Stepper Indicator */}
        <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between overflow-x-auto gap-1">
          {demoSteps.map((s) => (
            <button
              key={s.step}
              onClick={() => {
                setCurrentStep(s.step);
                onRunStep(s.step);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all shrink-0 ${
                currentStep === s.step
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400/50 shadow-md shadow-blue-600/30'
                  : currentStep > s.step
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.step}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 font-sans text-xs">
          <div className="flex items-center gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-3xl">{stepData.icon}</span>
            <div>
              <div className="text-blue-400 font-mono font-bold text-[11px]">
                STEP {stepData.step} OF 8
              </div>
              <h3 className="font-extrabold text-white text-base">{stepData.title}</h3>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="font-semibold text-slate-300">Action Description:</div>
              <p className="text-slate-400 text-xs leading-relaxed">{stepData.description}</p>

              <div className="pt-2 border-t border-slate-800/60 font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Expected Output:</span>
              </div>
              <p className="text-slate-300 text-xs font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                {stepData.expected}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onRunStep(stepData.step)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{stepData.actionLabel}</span>
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-semibold flex items-center gap-1 text-xs transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          <span className="text-slate-400 font-mono text-[11px]">
            Step {currentStep} / 8
          </span>

          <button
            onClick={handleNext}
            disabled={currentStep === demoSteps.length}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1 text-xs transition-colors shadow-md shadow-blue-600/20"
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
