import type { Vec2, Polygon, MultiPolygon, Ring } from "../terrain/terrainArea";
import { TerrainArea } from "../terrain/terrainArea";
import { transformStamp, getStamp, stampCount } from "../data/stamps";

export type BrushMode = "paint" | "erase";

type Opts = {
  area: TerrainArea;
  spacing?: number;
  spacingJitter?: number;
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
  private spacingJitter: number = 0.2;

  constructor(opts: Opts) {
    this.area = opts.area;
    this.spacing = opts.spacing ?? 10;
    this.baseScale = opts.scale ?? 1;
    this.rotRange = opts.rotRange ?? [0, Math.PI * 2];
    this.onChange = opts.onChange;

    this.accumulatePerStroke = opts.accumulatePerStroke ?? true;
    this.useCapsule = opts.useCapsule ?? false;
    this.capsuleRadiusPx = opts.capsuleRadiusPx;

    this.spacing = Math.max(8, this.spacing * 0.5);
    this.spacingJitter = opts.spacingJitter ?? 0.15;
  }

  setMode(mode: BrushMode) { this.mode = mode; }
  setScale(s: number) { this.baseScale = s; }
  setSpacing(px: number) { this.spacing = Math.max(1, px); }
  setArea(area: TerrainArea) { this.area = area; }

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

  // ---------------------------------------------------
  // 🔥 APPLY
  // ---------------------------------------------------
  private applyAt(p: Vec2, rotationRad: number, prev: Vec2 | null) {
    if (stampCount() === 0) return;
    const base: Polygon = getStamp(0);

    const poly = transformStamp(base, {
      translate: p,
      scale: this.baseScale,
      rotation: rotationRad,
      around: "outer-centroid",
    });

    const clean = this.cleanPolygon(poly);

    if (this.accumulatePerStroke) {
      if (!this.strokeArea) this.strokeArea = new TerrainArea();
      this.strokeArea.addStamp(clean);
      this.onChange?.();
      return;
    }

    if (this.mode === "paint") this.area.addStamp(clean);
    else this.area.eraseStamp(clean);

    this.scheduleChange();
  }

  // ---------------------------------------------------
  // 🔧 CLEAN POLYGON — rimuove auto-intersezioni interne
  // ---------------------------------------------------
  private cleanPolygon(poly: Polygon): Polygon {
    if (!poly || !poly[0] || poly[0].length < 3) return poly;

    const ring = poly[0];

    const cleaned: Ring = [];
    cleaned.push(ring[0]);

    for (let i = 1; i < ring.length; i++) {
      const [px, py] = cleaned[cleaned.length - 1];
      const [cx, cy] = ring[i];
      const dx = cx - px;
      const dy = cy - py;
      if (dx * dx + dy * dy > 1) cleaned.push([cx, cy]);
    }

    return [cleaned];
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
