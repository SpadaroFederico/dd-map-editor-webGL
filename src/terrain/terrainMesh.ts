// src/terrain/terrainMesh.ts
import * as PIXI from "pixi.js";
import type { MultiPolygon, Ring } from "./terrainArea";

/**
 * TerrainMesh genera solo una maschera (Graphics bianco)
 * da usare come mask per un TileBackground separato.
 */
export class TerrainMesh {
  public container: PIXI.Container;

  private maskShape: PIXI.Graphics;
  private lastGeometry: MultiPolygon | null = null;
  private repeatScale: number;

  constructor(app: PIXI.Application, repeatScale = 1) {
    this.repeatScale = repeatScale;
    this.container = new PIXI.Container();

    this.maskShape = new PIXI.Graphics();
    this.container.addChild(this.maskShape);
  }

  /** Graphics usata come mask. */
  get mask(): PIXI.Graphics {
    return this.maskShape;
  }

  async setTextureFromUrl(_url: string): Promise<void> {
    return;
  }

  setRepeatScale(s: number) {
    this.repeatScale = Math.max(0.01, s);
  }

  setSolidColor(_color: number, _alpha = 1) {
    // non usato in modalità mask
  }

  /** Aggiorna la geometria della maschera. */
  update(mp: MultiPolygon) {
    this.lastGeometry = mp;
    this.redraw();
  }

  private redraw() {
    const mp = this.lastGeometry;
    const g = this.maskShape;
    g.clear();

    if (!mp || mp.length === 0) return;

    g.beginFill(0xffffff, 1);

    for (const poly of mp) {
      if (!poly || poly.length === 0) continue;

      for (let r = 0; r < poly.length; r++) {
        const ring: Ring = poly[r];
        if (!ring || ring.length < 3) continue;

        g.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
          g.lineTo(ring[i][0], ring[i][1]);
        }
        g.lineTo(ring[0][0], ring[0][1]);
      }
    }

    g.endFill();
  }

  destroy() {
    this.maskShape.destroy();
    this.container.destroy({ children: true });
  }
}
