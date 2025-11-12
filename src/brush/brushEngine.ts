import type { Vec2, Polygon, MultiPolygon, Ring } from "../terrain/terrainArea";
import { TerrainArea } from "../terrain/terrainArea";
import { transformStamp, getStamp, stampCount } from "../data/stamps";

export type BrushMode = "paint" | "erase";

type Opts = {
  area: TerrainArea;
  spacing?: number;
  spacingJitter?: number; // frastagliatura controllata
  scale?: number;
  rotRange?: [number, number];
  onChange?: () => void;
  accumulatePerStroke?: boolean;
  useCapsule?: boolean;
  capsuleRadiusPx?: number;
  onDebug?: (info: any) => void;
};

export class BrushEngine {
  private area: TerrainArea;
  private spacing: number;
  private baseScale: number;
  private rotRange: [number, number];
  private onChange?: () => void;

  private isDown = false;
  private lastPos: Vec2 | null = null;
  private mode: BrushMode = "paint";
  private pending = false;

  private accumulatePerStroke: boolean;
  private strokeArea: TerrainArea | null = null;

  private useCapsule: boolean;
  private capsuleRadiusPx?: number;
  private spacingJitter: number = 0.2; // ±20% di variazione

  constructor(opts: Opts) {
    this.area = opts.area;
    this.spacing = opts.spacing ?? 10;
    this.baseScale = opts.scale ?? 1;
    this.rotRange = opts.rotRange ?? [0, Math.PI * 2];
    this.onChange = opts.onChange;

    this.accumulatePerStroke = opts.accumulatePerStroke ?? true;
    this.useCapsule = opts.useCapsule ?? false;
    this.capsuleRadiusPx = opts.capsuleRadiusPx;

    // --- Gestione frastagliatura e spaziatura ---
    this.spacing = Math.max(8, this.spacing * 0.5);
    this.spacingJitter = opts.spacingJitter ?? 0.15;
  }

  setMode(mode: BrushMode) { this.mode = mode; }
  setScale(s: number) { this.baseScale = s; }
  setSpacing(px: number) { this.spacing = Math.max(1, px); }

  /** Geometria temporanea della pennellata in corso (MultiPolygon) */
  getPreview(): MultiPolygon | null {
    return this.strokeArea ? this.strokeArea.geometry : null;
  }

  pointerDown(p: Vec2) {
    this.isDown = true;
    this.lastPos = p;
    if (this.accumulatePerStroke) this.strokeArea = new TerrainArea();
    this.applyAt(p, this.randomAngle(), null);
  }

  pointerMove(p: Vec2) {
    if (!this.isDown || !this.lastPos) return;

    const dx = p[0] - this.lastPos[0];
    const dy = p[1] - this.lastPos[1];
    const dist = Math.hypot(dx, dy);

    // jitter casuale: variazione ±20%
    const jitterFactor = 1 + (Math.random() * 2 - 1) * this.spacingJitter;
    const effectiveSpacing = this.spacing * jitterFactor;

    if (dist >= effectiveSpacing) {
      const prev = this.lastPos;
      this.lastPos = p;
      this.applyAt(p, this.randomAngle(), prev);
    }
  }

  pointerUp() {
    if (this.accumulatePerStroke && this.strokeArea) {
      const geo = this.strokeArea.geometry;
      if (this.mode === "paint") this.area.addStamp(geo);
      else this.area.eraseStamp(geo);
      this.strokeArea = null;
      this.scheduleChange();
    }
    this.isDown = false;
    this.lastPos = null;
  }

  // --- core ---
  private applyAt(p: Vec2, rotationRad: number, prev: Vec2 | null) {
    if (stampCount() === 0) return;
    const base: Polygon = getStamp(0);

    // stamp ruotato
    const poly = transformStamp(base, {
      translate: p,
      scale: this.baseScale,
      rotation: rotationRad,
      around: "outer-centroid",
    });

    // capsule disattivate
    const capsuleMP: MultiPolygon | null = null;

    if (this.accumulatePerStroke) {
      if (!this.strokeArea) this.strokeArea = new TerrainArea();
      this.strokeArea.addStamp(poly);
      if (capsuleMP) this.strokeArea.addStamp(capsuleMP);
      this.onChange?.();
      return;
    }

    if (this.mode === "paint") {
      this.area.addStamp(poly);
      if (capsuleMP) this.area.addStamp(capsuleMP);
    } else {
      this.area.eraseStamp(poly);
      if (capsuleMP) this.area.eraseStamp(capsuleMP);
    }
    this.scheduleChange();
  }

  private capsuleRadius(): number {
    return this.capsuleRadiusPx ?? Math.max(6, 8 * this.baseScale);
  }

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
