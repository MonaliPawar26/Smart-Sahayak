import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AMRState,
  AMRTelemetry,
  CellType,
  CollaborativeTandem,
  HumanWorker,
  Position2D,
  WarehouseTask,
} from '../core/types';
import { WarehouseMap } from '../core/WarehouseMap';
import { InFlightPacket, MeshLink } from '../core/P2PNetwork';
import { soundFx } from '../utils/AudioSynthesizer';
import {
  Eye,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
  Shield,
  Layers,
  ZoomIn,
  ZoomOut,
  Crosshair,
  AlertOctagon,
  Flame,
  Volume2,
  VolumeX,
  Users,
  Box,
  Cpu,
  Compass,
} from 'lucide-react';

interface WarehouseCanvasProps {
  map: WarehouseMap;
  robots: AMRTelemetry[];
  tasks: WarehouseTask[];
  humans?: HumanWorker[];
  tandems?: CollaborativeTandem[];
  activeMeshLinks: MeshLink[];
  inFlightPackets: InFlightPacket[];
  selectedRobotId?: string;
  onSelectRobot: (robotId: string) => void;
  onToggleObstacle: (gridX: number, gridY: number) => void;
  onToggleRFJammer?: (gridX: number, gridY: number) => void;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  map,
  robots,
  tasks,
  humans = [],
  tandems = [],
  activeMeshLinks,
  inFlightPackets,
  selectedRobotId,
  onSelectRobot,
  onToggleObstacle,
  onToggleRFJammer,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transformation states
  const [scale, setScale] = useState<number>(24); // Pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 25, y: 20 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [followRobotId, setFollowRobotId] = useState<string | null>(null);

  // Visual Layer toggles
  const [showRobots, setShowRobots] = useState<boolean>(true);
  const [showMesh, setShowMesh] = useState<boolean>(true);
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [showDeadZones, setShowDeadZones] = useState<boolean>(false);
  const [showSafetyRadius, setShowSafetyRadius] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showWorkers, setShowWorkers] = useState<boolean>(false);
  const [is3DIsometric, setIs3DIsometric] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<'OBSTACLE' | 'JAMMER' | 'INSPECT'>('OBSTACLE');

  // Mouse hover coordinate
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Sync sound mute
  useEffect(() => {
    soundFx.isMuted = isMuted;
  }, [isMuted]);

  // Handle follow robot camera pan
  useEffect(() => {
    if (followRobotId) {
      const robot = robots.find((r) => r.id === followRobotId);
      if (robot && containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        setPan({
          x: cw / 2 - robot.pos.x * scale,
          y: ch / 2 - robot.pos.y * scale,
        });
      }
    }
  }, [robots, followRobotId, scale]);

  // Main Canvas Rendering Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);

    // Optional 3D Isometric View Transformation Matrix
    if (is3DIsometric) {
      ctx.transform(1, 0.35, -0.6, 0.8, 120, -20);
    }

    const mapW = map.width * scale;
    const mapH = map.height * scale;

    // 2. Warehouse Floor Shadow & Boundary
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#0E1626';
    ctx.fillRect(0, 0, mapW, mapH);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, mapW, mapH);

    // 3. Grid Lines
    if (showGrid) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= map.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * scale, 0);
        ctx.lineTo(x * scale, mapH);
        ctx.stroke();
      }
      for (let y = 0; y <= map.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * scale);
        ctx.lineTo(mapW, y * scale);
        ctx.stroke();
      }
    }

    // 4. Warehouse Infrastructure: Highways, Aisles, Racks, Bays, Docks
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCellType(x, y);
        const px = x * scale;
        const py = y * scale;

        // Congestion Heatmap Render (if active)
        if (showHeatmap) {
          const density = map.congestionHeatmap[y] ? map.congestionHeatmap[y][x] || 0 : 0;
          if (density > 0) {
            const alpha = Math.min(0.65, density / 40);
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
            ctx.fillRect(px, py, scale, scale);
          }
        }

        switch (cell) {
          case CellType.HIGHWAY:
            ctx.fillStyle = '#111C30';
            ctx.fillRect(px, py, scale, scale);
            break;

          case CellType.AISLE:
            ctx.fillStyle = '#0F1A2A';
            ctx.fillRect(px, py, scale, scale);
            break;

          case CellType.BYPASS_BAY:
            // Dedicated Pull-in Alcove for Deadlock Resolution
            ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            ctx.fillRect(px, py, scale, scale);
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(px + 2, py + 2, scale - 4, scale - 4);
            ctx.setLineDash([]);
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BAY', px + scale / 2, py + scale / 2 + 3);
            break;

          case CellType.RACK:
            // Storage Steel Rack Pod (with 3D depth)
            const grad = ctx.createLinearGradient(px, py, px + scale, py + scale);
            grad.addColorStop(0, '#1E293B');
            grad.addColorStop(0.5, '#334155');
            grad.addColorStop(1, '#0F172A');
            ctx.fillStyle = grad;
            ctx.fillRect(px + 1, py + 1, scale - 2, scale - 2);

            // Shelf detail lines
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 1, py + 1, scale - 2, scale - 2);
            ctx.beginPath();
            ctx.moveTo(px + 3, py + scale / 2);
            ctx.lineTo(px + scale - 3, py + scale / 2);
            ctx.stroke();
            break;

          case CellType.CHARGING_PAD:
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            ctx.fillRect(px, py, scale, scale);
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2, py + 2, scale - 4, scale - 4);
            ctx.fillStyle = '#60A5FA';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚡CHG', px + scale / 2, py + scale / 2 + 3);
            break;

          case CellType.PICKUP_STATION:
            ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
            ctx.fillRect(px, py, scale, scale);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2, py + 2, scale - 4, scale - 4);
            ctx.fillStyle = '#FBBF24';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PICKUP', px + scale / 2, py + scale / 2 + 3);
            break;

          case CellType.DROPOFF_DOCK:
            ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
            ctx.fillRect(px, py, scale, scale);
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2, py + 2, scale - 4, scale - 4);
            ctx.fillStyle = '#A78BFA';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DOCK', px + scale / 2, py + scale / 2 + 3);
            break;

          case CellType.DYNAMIC_OBSTACLE:
            // Dynamic obstruction (fallen box/spill)
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.fillRect(px, py, scale, scale);
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, scale - 4, scale - 4);
            // Hazard diagonal stripes
            ctx.strokeStyle = '#F87171';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, py + scale);
            ctx.lineTo(px + scale, py);
            ctx.moveTo(px + scale / 2, py + scale);
            ctx.lineTo(px + scale, py + scale / 2);
            ctx.stroke();
            break;
        }
      }
    }

    // 5. Wi-Fi Dead Zones Overlay
    if (showDeadZones) {
      for (const dz of map.deadZones) {
        const dx = dz.x1 * scale;
        const dy = dz.y1 * scale;
        const dw = (dz.x2 - dz.x1 + 1) * scale;
        const dh = (dz.y2 - dz.y1 + 1) * scale;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(dx, dy, dw, dh);
        ctx.setLineDash([]);

        // Dead-zone badge
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`⚡ RF DEAD ZONE (-${dz.signalAttenuationPct}% dB)`, dx + 8, dy + 18);
      }
    }

    // 6. RF Jammer Cyber Defense Zones Overlay
    if (map.rfJammers && map.rfJammers.length > 0) {
      for (const jammer of map.rfJammers) {
        const jx = jammer.x * scale;
        const jy = jammer.y * scale;
        const jr = jammer.radius * scale;

        const jammerGrad = ctx.createRadialGradient(jx, jy, 5, jx, jy, jr);
        jammerGrad.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
        jammerGrad.addColorStop(1, 'rgba(168, 85, 247, 0.05)');

        ctx.beginPath();
        ctx.arc(jx, jy, jr, 0, Math.PI * 2);
        ctx.fillStyle = jammerGrad;
        ctx.fill();

        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#C084FC';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('📡 RF JAMMER (CYBER DEFENSE DRILL)', jx, jy - jr - 6);
      }
    }

    // 7. P2P Mesh Communication Overlay (Topology Links & Dynamic Packets)
    if (showMesh) {
      for (const link of activeMeshLinks) {
        ctx.beginPath();
        ctx.moveTo(link.fromPos.x * scale, link.fromPos.y * scale);
        ctx.lineTo(link.toPos.x * scale, link.toPos.y * scale);
        ctx.strokeStyle = `rgba(6, 182, 212, ${link.signalQuality * 0.4})`;
        ctx.lineWidth = Math.max(1, link.signalQuality * 2.5);
        ctx.stroke();
      }

      // In-flight P2P packets
      for (const packet of inFlightPackets) {
        const elapsed = (Date.now() / 1000) - packet.dispatchTime;
        const progress = Math.min(1.0, Math.max(0.0, elapsed / 0.4));
        const curX = packet.fromPos.x + (packet.toPos.x - packet.fromPos.x) * progress;
        const curY = packet.fromPos.y + (packet.toPos.y - packet.fromPos.y) * progress;

        ctx.beginPath();
        ctx.arc(curX * scale, curY * scale, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = packet.dropped ? '#EF4444' : '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 8. AMR Trajectories (Planned Paths & History)
    if (showPaths) {
      for (const robot of robots) {
        // Breadcrumb history
        if (robot.executedPathHistory.length > 1) {
          ctx.beginPath();
          ctx.moveTo(robot.executedPathHistory[0].x * scale, robot.executedPathHistory[0].y * scale);
          for (let i = 1; i < robot.executedPathHistory.length; i++) {
            ctx.lineTo(robot.executedPathHistory[i].x * scale, robot.executedPathHistory[i].y * scale);
          }
          ctx.strokeStyle = `${robot.color}33`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Planned path ahead
        if (robot.plannedPath.length > 0) {
          ctx.beginPath();
          ctx.moveTo(robot.pos.x * scale, robot.pos.y * scale);
          for (const pt of robot.plannedPath) {
            ctx.lineTo(pt.x * scale, pt.y * scale);
          }
          ctx.strokeStyle = robot.color;
          ctx.lineWidth = robot.id === selectedRobotId ? 3.5 : 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Goal waypoint marker
          const endPt = robot.plannedPath[robot.plannedPath.length - 1];
          if (endPt) {
            ctx.beginPath();
            ctx.arc(endPt.x * scale, endPt.y * scale, 4, 0, Math.PI * 2);
            ctx.fillStyle = robot.color;
            ctx.fill();
          }
        }
      }
    }

    // 9. Platooning Virtual Tether Links
    for (const robot of robots) {
      if (robot.isPlatooning && robot.platoonLeaderId) {
        const leader = robots.find((r) => r.id === robot.platoonLeaderId);
        if (leader) {
          ctx.beginPath();
          ctx.moveTo(robot.pos.x * scale, robot.pos.y * scale);
          ctx.lineTo(leader.pos.x * scale, leader.pos.y * scale);
          ctx.strokeStyle = '#06B6D4';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Tether label
          const midX = (robot.pos.x + leader.pos.x) / 2 * scale;
          const midY = (robot.pos.y + leader.pos.y) / 2 * scale;
          ctx.fillStyle = '#22D3EE';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🔗 PLATOON TETHER', midX, midY - 6);
        }
      }
    }

    // 10. Heavy Tandem Collaborative Transport Crates
    for (const tandem of tandems) {
      const r1 = robots.find((r) => r.id === tandem.masterRobotId);
      const r2 = robots.find((r) => r.id === tandem.followerRobotId);
      if (r1 && r2) {
        const x1 = r1.pos.x * scale;
        const y1 = r1.pos.y * scale;
        const x2 = r2.pos.x * scale;
        const y2 = r2.pos.y * scale;

        // Draw heavy metallic crate spanning between robots
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 14;
        ctx.stroke();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('📦 500KG HEAVY CRATE (TANDEM)', mx, my - 10);
      }
    }

    // 11. Dynamic Human Workers & Manual Forklifts
    for (const human of humans) {
      const hx = human.pos.x * scale;
      const hy = human.pos.y * scale;

      ctx.save();
      ctx.translate(hx, hy);

      if (human.type === 'HUMAN_WORKER') {
        // Human worker with hard hat
        ctx.beginPath();
        ctx.arc(0, 0, 0.35 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B'; // Yellow safety vest
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hard hat
        ctx.beginPath();
        ctx.arc(0, -2, 0.22 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👷 ' + human.name.split(' ')[0], 0, -0.45 * scale);

        if (human.isYieldingToRobot) {
          ctx.fillStyle = '#FBBF24';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🟡 STEPPING ASIDE (${human.yieldingForRobotId || 'AMR'})`, 0, 0.45 * scale);
        }
      } else {
        // Manual Forklift
        ctx.rotate(human.heading);
        ctx.fillStyle = '#EAB308';
        ctx.fillRect(-0.45 * scale, -0.3 * scale, 0.9 * scale, 0.6 * scale);
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-0.45 * scale, -0.3 * scale, 0.9 * scale, 0.6 * scale);

        // Forks
        ctx.fillStyle = '#475569';
        ctx.fillRect(0.45 * scale, -0.2 * scale, 0.3 * scale, 0.08 * scale);
        ctx.fillRect(0.45 * scale, 0.12 * scale, 0.3 * scale, 0.08 * scale);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🚜 FORKLIFT', 0, -0.4 * scale);
      }

      ctx.restore();
    }

    // 12. AMR Mobile Robots
    for (const robot of robots) {
      const rx = robot.pos.x * scale;
      const ry = robot.pos.y * scale;
      const rRadius = 0.45 * scale; // 0.45m physical radius
      const isSelected = robot.id === selectedRobotId;

      ctx.save();
      ctx.translate(rx, ry);

      // Safety Envelope Buffer
      if (showSafetyRadius) {
        ctx.beginPath();
        ctx.arc(0, 0, 0.90 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = `${robot.color}40`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Selection Ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, rRadius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Directional Headlight Beam
      ctx.save();
      ctx.rotate(robot.heading);
      const lightGrad = ctx.createRadialGradient(0, 0, rRadius, scale * 1.5, 0, scale * 2);
      lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, scale * 2, -Math.PI / 6, Math.PI / 6);
      ctx.closePath();
      ctx.fill();

      // AMR Chassis Body
      ctx.beginPath();
      ctx.arc(0, 0, rRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#1E293B';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Color accent ring
      ctx.lineWidth = 3;
      ctx.strokeStyle = robot.color;
      ctx.stroke();

      // Heading pointer arrow
      ctx.beginPath();
      ctx.moveTo(rRadius * 0.8, 0);
      ctx.lineTo(rRadius * 0.2, -rRadius * 0.4);
      ctx.lineTo(rRadius * 0.2, rRadius * 0.4);
      ctx.closePath();
      ctx.fillStyle = robot.color;
      ctx.fill();

      // Payload Box on Top
      if (robot.hasPayload) {
        ctx.fillStyle = '#D97706';
        ctx.fillRect(-rRadius * 0.4, -rRadius * 0.4, rRadius * 0.8, rRadius * 0.8);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-rRadius * 0.4, -rRadius * 0.4, rRadius * 0.8, rRadius * 0.8);
      }

      ctx.restore(); // restore heading rotation

      // Battery SOC Circular Meter
      const batPct = robot.batteryPct / 100;
      ctx.beginPath();
      ctx.arc(0, 0, rRadius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * batPct);
      ctx.strokeStyle = robot.batteryPct < 20 ? '#EF4444' : robot.batteryPct < 50 ? '#F59E0B' : '#10B981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Robot ID & State Badge Text
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(robot.id, 0, -rRadius - 6);

      // Status pill & Platoon / Jammer tag
      ctx.font = '8px sans-serif';
      let statusText = robot.state as string;
      let statusColor = '#94A3B8';

      if (robot.isRFJammed) {
        statusText = '⚡ RF JAMMED (BYZANTINE)';
        statusColor = '#C084FC';
      } else if (robot.isPlatooning) {
        statusText = '🔗 PLATOON';
        statusColor = '#22D3EE';
      } else if (robot.humanDetected) {
        statusText = '⚠️ HUMAN YIELD';
        statusColor = '#FBBF24';
      } else if (robot.isYielding) {
        statusText = 'YIELDING TO BAY';
        statusColor = '#A855F7';
      }

      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, 0, rRadius + 14);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // 13. Hover Coordinate Crosshair
    if (hoverCoord) {
      const hx = hoverCoord.x * scale;
      const hy = hoverCoord.y * scale;
      ctx.strokeStyle = activeTool === 'JAMMER' ? 'rgba(168, 85, 247, 0.8)' : 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx, hy, scale, scale);
    }

    ctx.restore(); // Restore pan/zoom
    ctx.restore(); // Restore dpr
  }, [
    map,
    robots,
    tasks,
    humans,
    tandems,
    activeMeshLinks,
    inFlightPackets,
    selectedRobotId,
    scale,
    pan,
    showMesh,
    showPaths,
    showDeadZones,
    showSafetyRadius,
    showGrid,
    showHeatmap,
    is3DIsometric,
    activeTool,
    hoverCoord,
  ]);

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      render();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [render]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setFollowRobotId(null);
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    // Calculate grid coordinate under mouse
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left - pan.x;
      const my = e.clientY - rect.top - pan.y;
      const gx = Math.floor(mx / scale);
      const gy = Math.floor(my / scale);
      if (gx >= 0 && gx < map.width && gy >= 0 && gy < map.height) {
        setHoverCoord({ x: gx, y: gy });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - pan.x;
    const my = e.clientY - rect.top - pan.y;
    const clickPos: Position2D = { x: mx / scale, y: my / scale };

    // 1. Check if clicked on a robot
    for (const robot of robots) {
      const dist = Math.hypot(robot.pos.x - clickPos.x, robot.pos.y - clickPos.y);
      if (dist <= 0.8) {
        onSelectRobot(robot.id);
        soundFx.playArrivalChime();
        return;
      }
    }

    const gx = Math.floor(clickPos.x);
    const gy = Math.floor(clickPos.y);
    if (gx >= 0 && gx < map.width && gy >= 0 && gy < map.height) {
      if (activeTool === 'JAMMER' && onToggleRFJammer) {
        onToggleRFJammer(gx, gy);
        soundFx.playCyberJamAlert();
      } else {
        onToggleObstacle(gx, gy);
        soundFx.playDeadlockResolveBeep();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(64, Math.max(16, scale * zoomFactor));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPan({
        x: mx - (mx - pan.x) * (newScale / scale),
        y: my - (my - pan.y) * (newScale / scale),
      });
      setScale(newScale);
    }
  };

  const resetView = () => {
    setFollowRobotId(null);
    setScale(24);
    setPan({ x: 25, y: 20 });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#080C14] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Top Left Floating Canvas Toolbar Controls */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-xl z-20">
        <button
          onClick={() => setScale((s) => Math.min(64, s * 1.2))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(16, s / 1.2))}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset Camera"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* 3D Isometric View Mode Toggle */}
        <button
          onClick={() => setIs3DIsometric(!is3DIsometric)}
          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold ${
            is3DIsometric ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle 3D Isometric Digital Twin Tilt"
        >
          <Compass className="w-4 h-4" />
          <span className="hidden sm:inline">3D ISO</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

        {/* Audio FX Mute Toggle */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title={isMuted ? 'Unmute Audio Cues' : 'Mute Audio Cues'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Follow Robot Selector */}
        <div className="flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5 text-blue-400 ml-1" />
          <select
            value={followRobotId || ''}
            onChange={(e) => setFollowRobotId(e.target.value ? e.target.value : null)}
            className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">Free View</option>
            {robots.map((r) => (
              <option key={r.id} value={r.id}>
                Follow {r.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Right Layer Visibility Toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-xl z-20 text-xs">
        {/* Active Tool Selector */}
        <button
          onClick={() => setActiveTool(activeTool === 'OBSTACLE' ? 'JAMMER' : 'OBSTACLE')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors ${
            activeTool === 'JAMMER'
              ? 'bg-purple-900 text-purple-200 border border-purple-500/40'
              : 'bg-red-950/80 text-red-200 border border-red-500/40'
          }`}
          title="Click to switch click action between Obstacle and RF Jammer"
        >
          {activeTool === 'JAMMER' ? 'Tool: RF Jammer' : 'Tool: Drop Obstacle'}
        </button>

        <div className="w-[1px] h-4 bg-slate-800 mx-1" />

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
            showHeatmap ? 'bg-orange-950/80 text-orange-300 border border-orange-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Congestion Risk Heatmap"
        >
          <Flame className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Heatmap</span>
        </button>

        <button
          onClick={() => setShowMesh(!showMesh)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
            showMesh ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle P2P Mesh Links"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">P2P Mesh</span>
        </button>

        <button
          onClick={() => setShowPaths(!showPaths)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
            showPaths ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Planned Paths"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Paths</span>
        </button>

        <button
          onClick={() => setShowDeadZones(!showDeadZones)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
            showDeadZones ? 'bg-red-950/80 text-red-300 border border-red-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle RF Dead Zones"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">RF Shadows</span>
        </button>

        <button
          onClick={() => setShowSafetyRadius(!showSafetyRadius)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
            showSafetyRadius ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Safety Radius"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Safety</span>
        </button>
      </div>

      {/* Interactive Helper Banner */}
      <div className="absolute bottom-3 left-3 bg-slate-900/85 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-slate-400 flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
        <span>
          Click tool: <strong>{activeTool === 'JAMMER' ? 'Deploy RF Jammer' : 'Inject Dynamic Aisle Blockage'}</strong> &bull; Watch AMRs react and gossip!
        </span>
      </div>
    </div>
  );
};
