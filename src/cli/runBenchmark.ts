import { BenchmarkRunner } from '../core/benchmarkRunner';
import { CoordinationMode } from '../core/types';

console.log('================================================================');
console.log('  BHARAT ELECTRONICS LIMITED (BEL) - AMR FLEET BENCHMARK SUITE  ');
console.log('  Edge-AI Based Distributed Fleet Coordination for AMRs        ');
console.log('================================================================\n');

console.log('Running comparative simulation benchmark (6 AMRs, 6 Tasks)...');
const res = BenchmarkRunner.runComparison(6, 6, 300);

console.log('\n----------------- BENCHMARK RESULTS SUMMARY -----------------');
console.table([
  {
    Mode: 'Decentralized Edge (Proposed)',
    'Makespan (s)': res.decentralized.makespanSec,
    'Throughput (Tasks/hr)': res.decentralized.throughputPerHour,
    Collisions: res.decentralized.collisionsDetected,
    'Avg Edge CPU (%)': res.decentralized.avgEdgeCpuPct,
    'Speedup vs Baseline': `${res.speedupPct}%`,
  },
  {
    Mode: 'Traditional Stop-and-Wait',
    'Makespan (s)': res.stopAndWait.makespanSec,
    'Throughput (Tasks/hr)': res.stopAndWait.throughputPerHour,
    Collisions: res.stopAndWait.collisionsDetected,
    'Avg Edge CPU (%)': res.stopAndWait.avgEdgeCpuPct,
    'Speedup vs Baseline': '0.0% (Baseline)',
  },
  {
    Mode: 'Centralized Cloud Server',
    'Makespan (s)': res.centralizedCloud.makespanSec,
    'Throughput (Tasks/hr)': res.centralizedCloud.throughputPerHour,
    Collisions: res.centralizedCloud.collisionsDetected,
    'Avg Edge CPU (%)': res.centralizedCloud.avgEdgeCpuPct,
    'Speedup vs Baseline': `${res.centralizedCloud.speedupVsStopAndWaitPct}%`,
  },
]);

console.log('\n----------------- BEL SUCCESS CRITERIA VALIDATION -----------------');
console.log(`[1] Zero Inter-Robot Collisions: ${res.decentralized.collisionsDetected === 0 ? 'PASSED (0 collisions)' : 'FAILED'}`);
console.log(`[2] Min 20% Reduction in Completion Time: ${res.speedupPct >= 20 ? `PASSED (${res.speedupPct}% speedup)` : 'FAILED'}`);
console.log(`\nOVERALL STATUS: ${res.passedBELSuccessCriteria ? 'SUCCESS - ALL BEL CRITERIA FULLY MET!' : 'FAILED'}\n`);
