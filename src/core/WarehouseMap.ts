import { CellType, DeadZoneArea, GridCoord, Position2D } from './types';

export class WarehouseMap {
  public width: number = 32; // Grid width (e.g. 32 meters)
  public height: number = 20; // Grid height (e.g. 20 meters)
  public grid: CellType[][];
  public dynamicObstacles: Map<string, { pos: GridCoord; detectedAt: number }>;
  public deadZones: DeadZoneArea[] = [];
  public rfJammers: { id: string; x: number; y: number; radius: number; active: boolean }[] = [];
  public congestionHeatmap: number[][];
  public bypassBays: GridCoord[] = [];
  public chargingPads: GridCoord[] = [];
  public pickupStations: GridCoord[] = [];
  public dropoffDocks: GridCoord[] = [];

  constructor(width = 48, height = 28) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.dynamicObstacles = new Map();
    this.rfJammers = [];
    this.congestionHeatmap = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => 0)
    );
    this.initLayout();
  }

  private initLayout(): void {
    // 1. Initialize all as FLOOR
    this.grid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => CellType.FLOOR)
    );

    // 2. Dual-Ring Rotary Highways (Outer Ring + Central Cross Interchange)
    // Top & Bottom Outer Highways
    for (let x = 0; x < this.width; x++) {
      this.grid[1][x] = CellType.HIGHWAY;
      this.grid[2][x] = CellType.HIGHWAY;
      this.grid[this.height - 2][x] = CellType.HIGHWAY;
      this.grid[this.height - 3][x] = CellType.HIGHWAY;
    }
    // Left & Right Outer Highways
    for (let y = 0; y < this.height; y++) {
      this.grid[y][1] = CellType.HIGHWAY;
      this.grid[y][2] = CellType.HIGHWAY;
      this.grid[y][this.width - 2] = CellType.HIGHWAY;
      this.grid[y][this.width - 3] = CellType.HIGHWAY;
    }

    // Central Rotary Cross Expressways (Middle Highways)
    for (let x = 0; x < this.width; x++) {
      this.grid[13][x] = CellType.HIGHWAY;
      this.grid[14][x] = CellType.HIGHWAY;
    }
    for (let y = 0; y < this.height; y++) {
      this.grid[y][23] = CellType.HIGHWAY;
      this.grid[y][24] = CellType.HIGHWAY;
    }

    // 3. Build 2x2 Matrix Storage Quad-Pods (Alpha, Beta, Gamma, Delta)
    const buildQuadPod = (startX: number, endX: number, startY: number, endY: number) => {
      for (let y = startY; y <= endY; y += 3) {
        for (let x = startX; x <= endX; x++) {
          if (y < this.height && x < this.width) {
            this.grid[y][x] = CellType.RACK;
            this.grid[y + 1][x] = CellType.RACK;
          }
        }
        const aisleY = y + 2;
        if (aisleY < this.height) {
          for (let x = startX; x <= endX; x++) {
            this.grid[aisleY][x] = CellType.AISLE;
          }
          // Add Pull-in Bypass Bays along aisles for conflict resolution
          const bayX1 = startX + 2;
          const bayX2 = endX - 2;
          if (bayX1 < this.width) {
            this.grid[aisleY - 1][bayX1] = CellType.BYPASS_BAY;
            this.bypassBays.push({ x: bayX1, y: aisleY - 1 });
          }
          if (bayX2 < this.width) {
            this.grid[aisleY + 1][bayX2] = CellType.BYPASS_BAY;
            this.bypassBays.push({ x: bayX2, y: aisleY + 1 });
          }
        }
      }
    };

    buildQuadPod(4, 20, 4, 11);   // Pod Alpha (North-West)
    buildQuadPod(27, 43, 4, 11);  // Pod Beta (North-East)
    buildQuadPod(4, 20, 16, 23);  // Pod Gamma (South-West)
    buildQuadPod(27, 43, 16, 23); // Pod Delta (South-East)

    // 4. Split Cross-Docking Inbound & Outbound Docks
    // Inbound Pickup Docks (Along North Wall: y=1)
    this.pickupStations = [
      { x: 4, y: 1 },
      { x: 8, y: 1 },
      { x: 12, y: 1 },
      { x: 16, y: 1 },
      { x: 28, y: 1 },
      { x: 32, y: 1 },
    ];
    for (const st of this.pickupStations) {
      this.grid[st.y][st.x] = CellType.PICKUP_STATION;
    }

    // Outbound Dropoff Docks (Along South & East Walls)
    this.dropoffDocks = [
      { x: 10, y: this.height - 2 },
      { x: 18, y: this.height - 2 },
      { x: 30, y: this.height - 2 },
      { x: 38, y: this.height - 2 },
      { x: this.width - 2, y: 8 },
      { x: this.width - 2, y: 20 },
    ];
    for (const dk of this.dropoffDocks) {
      this.grid[dk.y][dk.x] = CellType.DROPOFF_DOCK;
    }

    // 5. Dual Corner Charging Depots (NE & SW Corners)
    this.chargingPads = [
      // NE Depot
      { x: 38, y: 1 }, { x: 39, y: 1 }, { x: 40, y: 1 }, { x: 41, y: 1 },
      // SW Depot
      { x: 3, y: this.height - 2 }, { x: 4, y: this.height - 2 },
      { x: 5, y: this.height - 2 }, { x: 6, y: this.height - 2 },
    ];
    for (const pad of this.chargingPads) {
      this.grid[pad.y][pad.x] = CellType.CHARGING_PAD;
    }

    // 6. Central RF Shielded Component Vaults
    this.deadZones = [
      {
        id: 'deadzone-1',
        x1: 21,
        y1: 5,
        x2: 26,
        y2: 10,
        signalAttenuationPct: 90,
        description: 'Dense Heavy-Duty Steel Vault Core 1 (North Interchange)',
      },
      {
        id: 'deadzone-2',
        x1: 21,
        y1: 17,
        x2: 26,
        y2: 22,
        signalAttenuationPct: 85,
        description: 'Automated Shielded Avionics Vault Core 2 (South Interchange)',
      },
    ];
  }

  public isWalkable(x: number, y: number, ignoreDynamic = false): boolean {
    const gx = Math.round(x);
    const gy = Math.round(y);

    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) {
      return false;
    }

    const cell = this.grid[gy][gx];
    if (cell === CellType.RACK || cell === CellType.STATIC_OBSTACLE) {
      return false;
    }

    if (!ignoreDynamic && this.dynamicObstacles.has(`${gx},${gy}`)) {
      return false;
    }

    return true;
  }

  public getCellType(x: number, y: number): CellType {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) {
      return CellType.STATIC_OBSTACLE;
    }
    if (this.dynamicObstacles.has(`${gx},${gy}`)) {
      return CellType.DYNAMIC_OBSTACLE;
    }
    return this.grid[gy][gx];
  }

  public toggleDynamicObstacle(x: number, y: number): boolean {
    const key = `${x},${y}`;
    if (this.dynamicObstacles.has(key)) {
      this.dynamicObstacles.delete(key);
      return false;
    } else {
      // Don't place on racks or charging pads
      const type = this.getCellType(x, y);
      if (type !== CellType.RACK && type !== CellType.CHARGING_PAD) {
        this.dynamicObstacles.set(key, { pos: { x, y }, detectedAt: Date.now() });
        return true;
      }
      return false;
    }
  }

  public setDynamicObstacle(x: number, y: number, blocked: boolean): void {
    const key = `${x},${y}`;
    if (blocked) {
      this.dynamicObstacles.set(key, { pos: { x, y }, detectedAt: Date.now() });
    } else {
      this.dynamicObstacles.delete(key);
    }
  }

  public isInDeadZone(pos: Position2D): { inDeadZone: boolean; attenuation: number; description?: string } {
    for (const dz of this.deadZones) {
      if (pos.x >= dz.x1 && pos.x <= dz.x2 && pos.y >= dz.y1 && pos.y <= dz.y2) {
        return { inDeadZone: true, attenuation: dz.signalAttenuationPct, description: dz.description };
      }
    }
    return { inDeadZone: false, attenuation: 0 };
  }

  public findNearestBypassBay(pos: Position2D): GridCoord | null {
    if (this.bypassBays.length === 0) return null;
    let closest: GridCoord | null = null;
    let minDistance = Infinity;

    for (const bay of this.bypassBays) {
      const d = Math.hypot(bay.x - pos.x, bay.y - pos.y);
      if (d < minDistance) {
        minDistance = d;
        closest = bay;
      }
    }
    return closest;
  }

  public findNearestChargingPad(pos: Position2D): GridCoord {
    let closest = this.chargingPads[0];
    let minDistance = Infinity;

    for (const pad of this.chargingPads) {
      const d = Math.hypot(pad.x - pos.x, pad.y - pos.y);
      if (d < minDistance) {
        minDistance = d;
        closest = pad;
      }
    }
    return closest;
  }

  public toggleRFJammer(x: number, y: number): boolean {
    const existingIdx = this.rfJammers.findIndex(
      (j) => Math.hypot(j.x - x, j.y - y) < 3.0
    );
    if (existingIdx >= 0) {
      this.rfJammers.splice(existingIdx, 1);
      return false;
    } else {
      this.rfJammers.push({
        id: `jammer-${Date.now()}`,
        x,
        y,
        radius: 5.0,
        active: true,
      });
      return true;
    }
  }

  public isInRFJammer(pos: Position2D): { isJammed: boolean; jammerId?: string } {
    for (const jammer of this.rfJammers) {
      if (jammer.active) {
        const dist = Math.hypot(jammer.x - pos.x, jammer.y - pos.y);
        if (dist <= jammer.radius) {
          return { isJammed: true, jammerId: jammer.id };
        }
      }
    }
    return { isJammed: false };
  }

  public recordTraffic(x: number, y: number): void {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) {
      this.congestionHeatmap[gy][gx] = Math.min(100, (this.congestionHeatmap[gy][gx] || 0) + 1);
    }
  }

  public getRandomPickupStation(): Position2D {
    const idx = Math.floor(Math.random() * this.pickupStations.length);
    return { ...this.pickupStations[idx] };
  }

  public getRandomDropoffDock(): Position2D {
    const idx = Math.floor(Math.random() * this.dropoffDocks.length);
    return { ...this.dropoffDocks[idx] };
  }

  public getRandomRackLocation(): Position2D {
    // Pick an aisle coordinate adjacent to a rack
    const aisleCoords: GridCoord[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === CellType.AISLE) {
          aisleCoords.push({ x, y });
        }
      }
    }
    const target = aisleCoords[Math.floor(Math.random() * aisleCoords.length)] || { x: 8, y: 6 };
    return { ...target };
  }
}
