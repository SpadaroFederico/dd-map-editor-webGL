import type { Vec2, Polygon, MultiPolygon, Ring } from "../terrain/terrainArea";
import { TerrainArea } from "../terrain/terrainArea";
import { transformStamp, getStamp, stampCount } from "../data/stamps";

export type BrushMode = "paint" | "erase";

type Opts = {
  area: TerrainArea;
  // Spaziatura: scegli una delle due (se entrambe, vince spacingPx)
  spacing?: number;                // in coordinate mondo (legacy)
  spacingPx?: number;              // in pixel schermo (consigliato)
  getWorldScale?: () => number;    // per convertire px -> world

  scale?: number;
  rotRange?: [number, number];
  onChange?: () => void;

  accumulatePerStroke?: boolean;
  useCapsule?: boolean;
  capsuleRadiusPx?: number;

  spacingJitter?: number;          // 0..0.5 -> ±% di variazione
  minStampIntervalMs?: number;     // throttle temporale facoltativo

  // Debug: chiamata ad ogni timbro
  onDebug?: (info: {
    p: Vec2;
    prev: Vec2 | null;
    spacingWorld: number;
    nextSpacingWorld: number;
    distAccWorld: number;
    worldScale: number;
    capsuleRadius: number;
    rotation: number;
    isPreview: boolean;
  }) => void;
};

export class BrushEngine {
  private area: TerrainArea;
  private baseScale: number;
  private rotRange: [number, number];
  private onChange?: () => void;
  private onDebug?: Opts["onDebug"];

  private isDown = false;
  private lastPos: Vec2 | null = null;   // ultima POSIZIONE TIMBRO
  private lastP: Vec2 | null = null;     // ultimo PUNTATORE visto
  private mode: BrushMode = "paint";
  private pending = false;

  private accumulatePerStroke: boolean;
  private strokeArea: TerrainArea | null = null;

  private useCapsule: boolean;
  private capsuleRadiusPx?: number;

  // Spaziatura “a distanza accumulata”
  private spacingBaseWorld: number;      // soglia in world
  private spacingJitter: number;
  private minStampIntervalMs: number;
  private getWorldScale?: () => number;

  private fromPx(px: number): number {
    const s = this.getWorldScale ? this.getWorldScale() : 1;
    // spacing in world = pixel / scala
    return px / Math.max(1e-6, s);
  }

  private distAcc = 0;                   // distanza accumulata (world)
  private nextSpacingWorld = 0;          // soglia corrente (world)
  private lastStampTime = 0;

  constructor(opts: Opts) {
    this.area = opts.area;
    this.baseScale = opts.scale ?? 1;
    this.rotRange = opts.rotRange ?? [0, Math.PI * 2];
    this.onChange = opts.onChange;
    this.onDebug = opts.onDebug;

    this.accumulatePerStroke = opts.accumulatePerStroke ?? true;
    this.useCapsule = opts.useCapsule ?? true;
    this.capsuleRadiusPx = opts.capsuleRadiusPx;

    this.getWorldScale = opts.getWorldScale;

    // inizializza spacing base in WORLD:
    if (opts.spacingPx != null) {
      this.spacingBaseWorld = this.fromPx(opts.spacingPx);
    } else {
      this.spacingBaseWorld = Math.max(1, opts.spacing ?? 10);
    }
    this.spacingJitter = Math.max(0, Math.min(0.5, opts.spacingJitter ?? 0.15));
    this.minStampIntervalMs = Math.max(0, opts.minStampIntervalMs ?? 0);

    this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  // === API ===
  setMode(mode: BrushMode) { this.mode = mode; }
  setScale(s: number) { this.baseScale = s; }

  setSpacing(pxWorld: number) {
    this.spacingBaseWorld = Math.max(1, pxWorld);
    this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  setSpacingPx(pxScreen: number) {
    this.spacingBaseWorld = this.fromPx(pxScreen);
    this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  setSpacingJitter(p: number) {
    this.spacingJitter = Math.max(0, Math.min(0.5, p));
    this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
  }

  /** MultiPolygon della pennellata in corso (preview) */
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
    this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);

    if (this.accumulatePerStroke) this.strokeArea = new TerrainArea();

    // primo timbro immediato
    this.applyAt(p, this.randomAngle(), null);
  }

  pointerMove(p: Vec2) {
    if (!this.isDown || !this.lastP) return;

    // accumula distanza (world)
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

    // timbra solo quando superi la soglia
    if (this.distAcc >= this.nextSpacingWorld) {
      const prev = this.lastPos;
      this.lastPos = p;
      this.lastStampTime = now;
      const rot = this.randomAngle();

      this.applyAt(p, rot, prev);

      // debug
      this.onDebug?.({
        p,
        prev,
        spacingWorld: this.spacingBaseWorld,
        nextSpacingWorld: this.nextSpacingWorld,
        distAccWorld: this.distAcc,
        worldScale: this.getWorldScale ? this.getWorldScale() : 1,
        capsuleRadius: this.capsuleRadius(),
        rotation: rot,
        isPreview: !!this.strokeArea,
      });

      // reset accumulatore e nuova soglia con jitter
      this.distAcc = 0;
      this.nextSpacingWorld = this.spacingBaseWorld * (1 + (Math.random() * 2 - 1) * this.spacingJitter);
    }
  }

  pointerUp() {
    if (this.accumulatePerStroke && this.strokeArea) {
    let geo = this.strokeArea.geometry; // MultiPolygon

    // 🔹 semplifica leggermente il bordo per eliminare seghettature microscopiche
    geo = this.simplifyMultiPolygon(geo, 8 * this.baseScale); // epsilon = 8px circa

    if (this.mode === "paint") this.area.addStamp(geo);
    else this.area.eraseStamp(geo);

    this.strokeArea = null;
    this.scheduleChange();
}
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
    // per riempire bene tra timbri diradati: ~ 0.45 * spacing (in world) o fallback su scale
    const bySpacing = 0.45 * this.spacingBaseWorld;
    const byScale = Math.max(6, 8 * this.baseScale);
    return this.capsuleRadiusPx ?? Math.max(bySpacing, byScale);
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

  // Douglas–Peucker simplification leggera
private simplifyMultiPolygon(mp: MultiPolygon, epsilon: number): MultiPolygon {
  const simplifyRing = (ring: Vec2[]): Vec2[] => {
    const sqEps = epsilon * epsilon;
    const keep = new Array(ring.length).fill(false);
    keep[0] = keep[ring.length - 1] = true;

    const stack: [number, number][] = [[0, ring.length - 1]];
    while (stack.length > 0) {
      const [i1, i2] = stack.pop()!;
      let maxDist = 0;
      let idx = -1;
      const [x1, y1] = ring[i1];
      const [x2, y2] = ring[i2];
      const dx = x2 - x1;
      const dy = y2 - y1;

      const len2 = dx * dx + dy * dy;
      for (let i = i1 + 1; i < i2; i++) {
        const [px, py] = ring[i];
        const t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
        const projx = x1 + t * dx;
        const projy = y1 + t * dy;
        const dist2 = (px - projx) ** 2 + (py - projy) ** 2;
        if (dist2 > maxDist) {
          maxDist = dist2;
          idx = i;
        }
      }

      if (maxDist > sqEps && idx !== -1) {
        keep[idx] = true;
        stack.push([i1, idx]);
        stack.push([idx, i2]);
      }
    }
    return ring.filter((_, i) => keep[i]);
  };

  const out: MultiPolygon = [];
  for (const poly of mp) {
    const newPoly: any[] = [];
    for (const ring of poly) {
      if (ring.length > 3) newPoly.push(simplifyRing(ring));
      else newPoly.push(ring);
    }
    out.push(newPoly);
  }
  return out;
}

}
