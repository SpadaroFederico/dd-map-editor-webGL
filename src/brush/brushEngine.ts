import type { Vec2, Polygon, MultiPolygon, Ring } from "../terrain/terrainArea";
import { TerrainArea } from "../terrain/terrainArea";
import { transformStamp, getStamp, stampCount } from "../data/stamps";

export type BrushMode = "paint" | "erase";

type Opts = {
  area: TerrainArea;
  spacing?: number;                 // base spacing in px
  scale?: number;
  rotRange?: [number, number];
  onChange?: () => void;

  accumulatePerStroke?: boolean;
  useCapsule?: boolean;
  capsuleRadiusPx?: number;

  // NUOVO: controllo della cadenza dei timbri
  spacingJitter?: number;           // 0..0.5 -> ±% di variazione
  minStampIntervalMs?: number;      // throttle temporale facoltativo
};

export class BrushEngine {
  private area: TerrainArea;
  private baseScale: number;
  private rotRange: [number, number];
  private onChange?: () => void;

  private isDown = false;
  private lastPos: Vec2 | null = null;      // ultima POSIZIONE TIMBRO
  private lastP: Vec2 | null = null;        // ultimo PUNTATORE visto
  private mode: BrushMode = "paint";
  private pending = false;

  private accumulatePerStroke: boolean;
  private strokeArea: TerrainArea | null = null;

  private useCapsule: boolean;
  private capsuleRadiusPx?: number;

  // === NUOVO: spaziatura “a distanza accumulata” ===
  private spacingBase: number;
  private spacingJitter: number;
  private minStampIntervalMs: number;

  private distAcc = 0;              // distanza accumulata dall'ultimo timbro
  private nextSpacing = 0;          // soglia corrente (con jitter)
  private lastStampTime = 0;

  constructor(opts: Opts) {
    this.area = opts.area;
    this.baseScale = opts.scale ?? 1;
    this.rotRange = opts.rotRange ?? [0, Math.PI * 2];
    this.onChange = opts.onChange;

    this.accumulatePerStroke = opts.accumulatePerStroke ?? true;
    this.useCapsule = opts.useCapsule ?? true;
    this.capsuleRadiusPx = opts.capsuleRadiusPx;

    this.spacingBase = Math.max(1, opts.spacing ?? 10);
    this.spacingJitter = Math.max(0, Math.min(0.5, opts.spacingJitter ?? 0.15));
    this.minStampIntervalMs = Math.max(0, opts.minStampIntervalMs ?? 0);

    this.nextSpacing = this.spacingBase * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  // === API ===
  setMode(mode: BrushMode) { this.mode = mode; }
  setScale(s: number) { this.baseScale = s; }
  setSpacing(px: number) {
    this.spacingBase = Math.max(1, px);
    this.nextSpacing = this.spacingBase * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }
  setSpacingJitter(p: number) {
    this.spacingJitter = Math.max(0, Math.min(0.5, p));
    this.nextSpacing = this.spacingBase * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  /** MultiPolygon della pennellata in corso (per la preview) */
  getPreview(): MultiPolygon | null {
    return this.strokeArea ? this.strokeArea.geometry : null;
  }

  // === Pointer ===
  pointerDown(p: Vec2) {
    this.isDown = true;
    this.lastPos = p;
    this.lastP = p;
    this.distAcc = 0;
    this.lastStampTime = performance.now();
    this.nextSpacing = this.spacingBase * (1 + (Math.random() * 2 - 1) * this.spacingJitter);

    if (this.accumulatePerStroke) this.strokeArea = new TerrainArea();

    // primo timbro immediato
    this.applyAt(p, this.randomAngle(), null);
  }

  pointerMove(p: Vec2) {
    if (!this.isDown || !this.lastP) return;

    // accumula distanza
    const dx = p[0] - this.lastP[0];
    const dy = p[1] - this.lastP[1];
    const d = Math.hypot(dx, dy);
    if (d <= 0) return;

    this.distAcc += d;
    this.lastP = p;

    // throttle temporale (facoltativo)
    const now = performance.now();
    if (this.minStampIntervalMs > 0 && now - this.lastStampTime < this.minStampIntervalMs) {
      return;
    }

    // timbra solo quando superi la soglia corrente
    if (this.distAcc >= this.nextSpacing) {
      const prev = this.lastPos;
      this.lastPos = p;
      this.lastStampTime = now;
      this.applyAt(p, this.randomAngle(), prev);

      // reset accumulatore e nuova soglia con jitter
      this.distAcc = 0;
      this.nextSpacing = this.spacingBase * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
    }
  }

  pointerUp() {
    if (this.accumulatePerStroke && this.strokeArea) {
      const geo = this.strokeArea.geometry;
      if (this.mode === "paint") this.area.addStamp(geo);
      else this.area.eraseStamp(geo);
      this.strokeArea = null;
      this.scheduleChange(); // notifica “finale”
    }
    this.isDown = false;
    this.lastPos = null;
    this.lastP = null;
    this.distAcc = 0;
  }

  // === core ===
  private applyAt(p: Vec2, rotationRad: number, prev: Vec2 | null) {
    if (stampCount() === 0) return;
    const base: Polygon = getStamp(0);

    const poly = transformStamp(base, {
      translate: p,
      scale: this.baseScale,
      rotation: rotationRad,
      around: "outer-centroid",
    });

    const capR = this.capsuleRadius();

    if (this.accumulatePerStroke) {
      if (!this.strokeArea) this.strokeArea = new TerrainArea();
      this.strokeArea.addStamp(poly);
      if (this.useCapsule && prev) {
        const cap: MultiPolygon = [[ this.makeCapsule(prev, p, capR, 4) ]];
        this.strokeArea.addStamp(cap);
      }
      this.onChange?.();
      return;
    }

    if (this.mode === "paint") {
      this.area.addStamp(poly);
      if (this.useCapsule && prev) {
        const cap: MultiPolygon = [[ this.makeCapsule(prev, p, capR, 4) ]];
        this.area.addStamp(cap);
      }
    } else {
      this.area.eraseStamp(poly);
      if (this.useCapsule && prev) {
        const cap: MultiPolygon = [[ this.makeCapsule(prev, p, capR, 4) ]];
        this.area.eraseStamp(cap);
      }
    }
    this.scheduleChange();
  }

  private capsuleRadius(): number {
    // raggio ~ metà spaziatura per “riempire” bene tra i timbri
    const bySpacing = 0.45 * this.spacingBase;
    const byScale = Math.max(6, 8 * this.baseScale);
    return this.capsuleRadiusPx ?? Math.max(bySpacing, byScale);
  }

  // capsula: rettangolo + 2 semicirconferenze (pochi step = veloce)
  private makeCapsule(a: Vec2, b: Vec2, r: number, steps = 4): Ring {
    const [x1, y1] = a, [x2, y2] = b;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    const pts: Vec2[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = Math.PI * t - Math.PI / 2;
      const cx = x2 + nx * (Math.cos(ang) * r) + ux * (Math.sin(ang) * r);
      const cy = y2 + ny * (Math.cos(ang) * r) + uy * (Math.sin(ang) * r);
      pts.push([cx, cy]);
    }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = Math.PI * t + Math.PI / 2;
      const cx = x1 + nx * (Math.cos(ang) * r) + ux * (Math.sin(ang) * r);
      const cy = y1 + ny * (Math.cos(ang) * r) + uy * (Math.sin(ang) * r);
      pts.push([cx, cy]);
    }
    return pts as Ring;
  }

  private randomAngle(): number {
    const [a, b] = this.rotRange;
    return a + Math.random() * (b - a);
  }

  private scheduleChange() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.onChange?.();
    });
  }
}
