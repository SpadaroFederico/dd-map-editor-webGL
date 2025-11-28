// src/rendering/renderer.ts

import * as PIXI from "pixi.js";
import type {
  EditorState
} from "../core/state";
import type {
  TilePatternConfig,
  MultiPolygon,
  Point2D,
  MaterialId,
} from "../core/types";
import type { ShovelTool } from "../core/tools/shovelTool";

import { BlurFilter } from "pixi.js";
import { createTilePatternLayer, type TilePatternLayer } from "./tilePatterns";

// Mappa: materiale → lista di file delle tiles da caricare
// ⚠️ Metti qui i NOMI REALI dei tuoi file per grass / water
const MATERIAL_TILE_FILES: Record<string, string[]> = {
  dirt: [
    '/tiles/dirt/dirt_stylized_rock_1.png',
    '/tiles/dirt/dirt_stylized_rock_2.png',
    '/tiles/dirt/dirt_stylized_rock_3.png',
    '/tiles/dirt/dirt_stylized_rock_4.png',
    '/tiles/dirt/dirt_stylized_rock_5.png',
    '/tiles/dirt/dirt_stylized_rock_6.png',
    '/tiles/dirt/dirt_stylized_rock_7.png',
    '/tiles/dirt/dirt_stylized_rock_8.png',
    '/tiles/dirt/dirt_stylized_rock_9.png',
    '/tiles/dirt/dirt_stylized_rock_10.png',
    '/tiles/dirt/dirt_stylized_rock_11.png',
    '/tiles/dirt/dirt_stylized_rock_12.png',
    '/tiles/dirt/dirt_stylized_rock_13.png',
    '/tiles/dirt/dirt_stylized_rock_14.png',
    '/tiles/dirt/dirt_stylized_rock_15.png',
  ],

  // 👇 Sostituisci i nomi con quelli reali che hai in /tiles/grass
  grass: [
    '/tiles/grass/grass_1.png',
    '/tiles/grass/grass_2.png',
    '/tiles/grass/grass_3.png',
    '/tiles/grass/grass_4.png',
    '/tiles/grass/grass_5.png',
    '/tiles/grass/grass_6.png',
    '/tiles/grass/grass_7.png',
    '/tiles/grass/grass_8.png',
    '/tiles/grass/grass_9.png',
    '/tiles/grass/grass_10.png',
    '/tiles/grass/grass_11.png',
    '/tiles/grass/grass_12.png',
    '/tiles/grass/grass_13.png',
    '/tiles/grass/grass_14.png',
    '/tiles/grass/grass_15.png',
  ],

  // 👇 Sostituisci i nomi con quelli reali che hai in /tiles/water
  water: [
    '/tiles/water/water_1.png',
    '/tiles/water/water_2.png',
    '/tiles/water/water_3.png',
    '/tiles/water/water_4.png',
    '/tiles/water/water_5.png',
    '/tiles/water/water_6.png',
    '/tiles/water/water_7.png',
    '/tiles/water/water_8.png',
    '/tiles/water/water_9.png',
    '/tiles/water/water_10.png',
    '/tiles/water/water_11.png',
    '/tiles/water/water_12.png',
    '/tiles/water/water_13.png',
    '/tiles/water/water_14.png',
    '/tiles/water/water_15.png',
  ],
};


interface EditorRendererOptions {
  canvas?: HTMLCanvasElement;
}

export class EditorRenderer {
  app: PIXI.Application;
  worldContainer: PIXI.Container;
  backgroundTilesContainer: PIXI.Container;
  shovelFillContainer: PIXI.Container;

  private editorState: EditorState;
  private shovelTool: ShovelTool;
  private dirtPattern: TilePatternLayer;

  // tutte le texture per materiale
  private materialTextures: Record<string, PIXI.Texture[]> = {};

  // comodo alias per il terreno base
  private dirtTextures: PIXI.Texture[] = [];

  private isInitialized = false;


  private tilesPerSide = 60;
  private mapWidth = 0;
  private mapHeight = 0;

  // MASK SHOVEL
  private shovelMaskContainer: PIXI.Container;
  private shovelBaseMaskGraphics: PIXI.Graphics;
  private shovelStrokeMaskGraphics: PIXI.Graphics;

  // PAINT BACKGROUND (bg): tiles + mask
  private bgPaintContainer: PIXI.Container;  // layer di tiles BG
  private bgPaintMask: PIXI.Graphics;        // mask del paint BG

  // GLOW (alone bianco)
  private shovelGlowGraphics: PIXI.Graphics;

  // INNER SHADOW (bordo interno)
  private shovelInnerShadowGraphics: PIXI.Graphics;

  // BORDO FINALE + bordi sottili offsettati
  private shovelBorderGraphics: PIXI.Graphics;

constructor(
  editorState: EditorState,
  shovelTool: ShovelTool,
  options?: EditorRendererOptions,
) {
  this.editorState = editorState;
  this.shovelTool = shovelTool;

  this.app = new PIXI.Application({
    view: options?.canvas,
    resizeTo: window,
    antialias: true,
    background: 0x20252b,
  });

  // Root del mondo
  this.worldContainer = new PIXI.Container();
  this.app.stage.addChild(this.worldContainer);

  // 1) SFONDO BASE
  this.backgroundTilesContainer = new PIXI.Container();
  this.worldContainer.addChild(this.backgroundTilesContainer);

  // 2) MASK BG (sotto al paint, così i cerchi bianchi sono coperti)
  this.bgPaintMask = new PIXI.Graphics();
  this.bgPaintMask.alpha = 1;          // alpha piena → mask efficace
  this.worldContainer.addChild(this.bgPaintMask);

  // 3) PAINT BG (sopra la mask, sotto la shovel)
  this.bgPaintContainer = new PIXI.Container();
  this.bgPaintContainer.visible = false;  // parte nascosto
  this.worldContainer.addChild(this.bgPaintContainer);

  // collega la mask al layer di paint
  this.bgPaintContainer.mask = this.bgPaintMask;

  // 4) GLOW SHOVEL (sotto il fill)
  this.shovelGlowGraphics = new PIXI.Graphics();
  this.shovelGlowGraphics.alpha = 0.4;
  this.shovelGlowGraphics.filters = [new BlurFilter(50)];
  this.worldContainer.addChild(this.shovelGlowGraphics);

  // 5) SHOVEL FILL
  this.shovelFillContainer = new PIXI.Container();
  this.worldContainer.addChild(this.shovelFillContainer);

  // 6) INNER SHADOW
  this.shovelInnerShadowGraphics = new PIXI.Graphics();
  this.shovelInnerShadowGraphics.alpha = 0.7;
  this.shovelInnerShadowGraphics.filters = [new BlurFilter(12)];
  this.worldContainer.addChild(this.shovelInnerShadowGraphics);

  // 7) MASK SHOVEL
  this.shovelMaskContainer = new PIXI.Container();
  this.shovelBaseMaskGraphics = new PIXI.Graphics();
  this.shovelStrokeMaskGraphics = new PIXI.Graphics();

  this.shovelMaskContainer.addChild(this.shovelBaseMaskGraphics);
  this.shovelMaskContainer.addChild(this.shovelStrokeMaskGraphics);

  this.worldContainer.addChild(this.shovelMaskContainer);
  this.shovelFillContainer.mask = this.shovelMaskContainer;

  // 8) BORDO SHOVEL
  this.shovelBorderGraphics = new PIXI.Graphics();
  this.worldContainer.addChild(this.shovelBorderGraphics);

  // Tile pattern terreno (dirt)
  const dirtConfig: TilePatternConfig = {
    materialId: "dirt",
    tileSize: 337,
    variants: [
      "dirt_1",
      "dirt_2",
      "dirt_3",
      "dirt_4",
      "dirt_5",
      "dirt_6",
      "dirt_7",
      "dirt_8",
      "dirt_9",
      "dirt_10",
      "dirt_11",
      "dirt_12",
      "dirt_13",
      "dirt_14",
      "dirt_15",
    ],
    seed: 12345,
  };

  this.dirtPattern = createTilePatternLayer(dirtConfig);
  this.computeMapSize();
  this.updateCamera();
}




  // ---------------------------------------------------------
  // INIT
  // ---------------------------------------------------------
  async init(): Promise<void> {
    await this.loadMaterialTextures();
    this.drawBackgroundFromPattern();
    this.drawShovelPatternFromPattern();

    // tiles per il paint BG (una sola volta)
    this.buildBackgroundPaintLayer(this.editorState.activeMaterial);

    const shape = this.editorState.world.shovel.shape;

    this.renderShovelBase(shape);
    this.renderShovelEffects(shape); // glow bianco
    this.renderShovelBorder(shape);  // inner shadow + bordo scuro + sottili

    this.fitCameraToMap();
    this.isInitialized = true;
  }

  // ---------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------
  updateCamera(): void {
    this.worldContainer.scale.set(this.editorState.cameraScale);
    this.worldContainer.position.set(
      this.editorState.cameraOffset.x,
      this.editorState.cameraOffset.y,
    );
  }

  private computeMapSize(): void {
    const t = this.dirtPattern.config.tileSize;
    this.mapWidth = this.tilesPerSide * t;
    this.mapHeight = this.tilesPerSide * t;
  }

  private fitCameraToMap(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    if (this.mapWidth <= 0 || this.mapHeight <= 0) return;

    const sx = w / this.mapWidth;
    const sy = h / this.mapHeight;
    const scale = Math.min(sx, sy) * 0.9;

    this.editorState.cameraScale = scale;
    this.editorState.cameraOffset.x = w / 2;
    this.editorState.cameraOffset.y = h / 2;

    this.updateCamera();
  }

  // ---------------------------------------------------------
  // LOAD TEXTURES
  // ---------------------------------------------------------
  // carica tutte le tiles di tutti i materiali definiti in MATERIAL_TILE_FILES
  private async loadMaterialTextures(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [materialId, files] of Object.entries(MATERIAL_TILE_FILES)) {
      const texPromises: Promise<PIXI.Texture>[] = files.map((filePath) =>
        PIXI.Assets.load(filePath),
      );

      const p = Promise.all(texPromises).then((textures) => {
        this.materialTextures[materialId] = textures;
      });

      loadPromises.push(p);
    }

    await Promise.all(loadPromises);

    // alias comodo per il terreno base
    this.dirtTextures = this.materialTextures['dirt'] ?? [];
  }


  // ---------------------------------------------------------
  // BACKGROUND + SHOVEL PATTERN
  // ---------------------------------------------------------
  private drawBackgroundFromPattern(): void {
    const t = this.dirtPattern.config.tileSize;
    const half = this.tilesPerSide / 2;
    const n = this.dirtTextures.length;

    this.backgroundTilesContainer.removeChildren();

    for (let i = 0; i < this.tilesPerSide; i++) {
      for (let j = 0; j < this.tilesPerSide; j++) {
        const x = (i - half) * t;
        const y = (j - half) * t;
        const idx = this.dirtPattern.getVariantIndex(i, j);

        const tex = n > 0 ? this.dirtTextures[idx % n] : null;

        if (tex) {
          const s = new PIXI.Sprite(tex);
          s.x = x;
          s.y = y;
          s.width = t;
          s.height = t;
          this.backgroundTilesContainer.addChild(s);
        }
      }
    }

    // Croce di debug centro mappa
    const axis = new PIXI.Graphics();
    axis.lineStyle(2, 0xff5555, 1);
    axis.moveTo(-1000, 0);
    axis.lineTo(1000, 0);
    axis.moveTo(0, -1000);
    axis.lineTo(0, 1000);
    this.backgroundTilesContainer.addChild(axis);
  }

  private drawShovelPatternFromPattern(): void {
    const t = this.dirtPattern.config.tileSize;
    const half = this.tilesPerSide / 2;
    const n = this.dirtTextures.length;

    this.shovelFillContainer.removeChildren();

    for (let i = 0; i < this.tilesPerSide; i++) {
      for (let j = 0; j < this.tilesPerSide; j++) {
        const x = (i - half) * t;
        const y = (j - half) * t;
        const idx = this.dirtPattern.getVariantIndex(i, j);

        const tex = n > 0 ? this.dirtTextures[idx % n] : null;

        if (tex) {
          const s = new PIXI.Sprite(tex);
          s.x = x;
          s.y = y;
          s.width = t;
          s.height = t;
          s.tint = 0xaa7744; // terra scavata (shovel)
          this.shovelFillContainer.addChild(s);
        } else {
          const g = new PIXI.Graphics();
          g.beginFill(0x543015);
          g.drawRect(x, y, t, t);
          g.endFill();
          this.shovelFillContainer.addChild(g);
        }
      }
    }
  }

  // ---------------------------------------------------------
  // COSTRUZIONE TILES PER PAINT BG (UNA VOLTA SOLA)
  // ---------------------------------------------------------
    private getMaterialTint(materialId: MaterialId): number {
    return 0xff0000; // DEBUG: rosso forte, giusto per vedere il paint
    }


  private buildBackgroundPaintLayer(materialId: MaterialId): void {
    this.bgPaintContainer.removeChildren();

    // scegliamo le texture per il materiale richiesto;
    // se non trovate, fallback a dirt
    const textures =
      this.materialTextures[materialId] ?? this.materialTextures['dirt'] ?? [];

    const n = textures.length;
    if (n === 0) return;

    const t = this.dirtPattern.config.tileSize;
    const half = this.tilesPerSide / 2;

    for (let i = 0; i < this.tilesPerSide; i++) {
      for (let j = 0; j < this.tilesPerSide; j++) {
        const x = (i - half) * t;
        const y = (j - half) * t;

        // usiamo SEMPRE lo stesso pattern logico (dirtPattern)
        const idx = this.dirtPattern.getVariantIndex(i, j);
        const tex = textures[idx % n];

        const sprite = new PIXI.Sprite(tex);
        sprite.x = x;
        sprite.y = y;
        sprite.width = t;
        sprite.height = t;

        // niente tint: usiamo la tile così com’è
        this.bgPaintContainer.addChild(sprite);
      }
    }

    // all'inizio la mask è vuota → niente BG visibile
    this.bgPaintContainer.visible = false;
  }


  // ---------------------------------------------------------
  // MULTIPOLYGON DRAWING
  // ---------------------------------------------------------
  private drawMultiPolygon(g: PIXI.Graphics, shape: MultiPolygon): void {
    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length === 0) continue;

      // anello esterno
      g.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
      g.lineTo(outer[0].x, outer[0].y);

      // buchi interni
      if (poly.holes && poly.holes.length > 0) {
        g.beginHole();
        for (const hole of poly.holes) {
          if (!hole || hole.length === 0) continue;
          g.moveTo(hole[0].x, hole[0].y);
          for (let j = 1; j < hole.length; j++) g.lineTo(hole[j].x, hole[j].y);
          g.lineTo(hole[0].x, hole[0].y);
        }
        g.endHole();
      }
    }
  }

  // ---------------------------------------------------------
  // MASK BASE SHOVEL
  // ---------------------------------------------------------
  renderShovelBase(shape: MultiPolygon): void {
    this.shovelBaseMaskGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.shovelBaseMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelBaseMaskGraphics, shape);
    this.shovelBaseMaskGraphics.endFill();
  }

  // ---------------------------------------------------------
  // PREVIEW STROKE SHOVEL
  // ---------------------------------------------------------
  renderShovelStrokeInitial(shape: MultiPolygon | null): void {
    this.shovelStrokeMaskGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelStrokeMaskGraphics, shape);
    this.shovelStrokeMaskGraphics.endFill();
  }

  appendShovelStroke(shape: MultiPolygon | null): void {
    if (!shape || shape.length === 0) return;

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelStrokeMaskGraphics, shape);
    this.shovelStrokeMaskGraphics.endFill();
  }

  clearShovelStroke(): void {
    this.shovelStrokeMaskGraphics.clear();
  }

  // ---------------------------------------------------------
  // EFFECTS (alone bianco)
  // ---------------------------------------------------------
  renderShovelEffects(shape: MultiPolygon): void {
    this.renderShovelGlow(shape);
  }

  private renderShovelGlow(shape: MultiPolygon): void {
    this.shovelGlowGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.shovelGlowGraphics.beginFill(0xffffff);
    this.drawMultiPolygon(this.shovelGlowGraphics, shape);
    this.shovelGlowGraphics.endFill();
  }

  // ---------------------------------------------------------
  // PAINT BG API (usa tiles + mask, NON colore)
  // ---------------------------------------------------------
  renderBackgroundPaint(
    shape: MultiPolygon | null,
    _color: number = 0xffffff, // ignorati, ma lasciati per compatibilità
    _alpha: number = 1.0,
  ): void {
    this.bgPaintMask.clear();

    if (!shape || !shape.length) {
      this.bgPaintContainer.visible = false;
      return;
    }

    this.bgPaintContainer.visible = true;

    this.bgPaintMask.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.bgPaintMask, shape);
    this.bgPaintMask.endFill();
  }

  /**
   * Disegna un "dot" di paint BG nella mask.
   * Usato dal BrushStrokeController (TOOL_ID.Paint + mode Background).
   */
    paintBackgroundDot(
    x: number,
    y: number,
    radius: number,
    _color: number = 0xffffff,
    _alpha: number = 1.0,
    ): void {
    console.log('PAINT DOT', { x, y, radius });

    this.bgPaintContainer.visible = true;

    this.bgPaintMask.beginFill(0xffffff, 1);
    this.bgPaintMask.drawCircle(x, y, radius);
    this.bgPaintMask.endFill();
    }


  // ---------------------------------------------------------
  // UTILITY PER OFFSET BORDI SOTTILI
  // ---------------------------------------------------------
  private computeSignedArea(ring: Point2D[]): number {
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % n];
      area += p.x * q.y - q.x * p.y;
    }
    return area * 0.5;
  }

  private drawOffsetRing(
    g: PIXI.Graphics,
    ring: Point2D[],
    offsetPx: number,
    color: number,
    alpha: number,
    lineWidth: number,
  ): void {
    if (!ring || ring.length < 3) return;

    const n = ring.length;
    const ccw = this.computeSignedArea(ring) > 0;

    const offsetPoints: Point2D[] = [];

    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n];
      const curr = ring[i];
      const next = ring[(i + 1) % n];


      // edge prev->curr
      let dx1 = curr.x - prev.x;
      let dy1 = curr.y - prev.y;
      let len1 = Math.hypot(dx1, dy1) || 1;
      dx1 /= len1;
      dy1 /= len1;

      // edge curr->next
      let dx2 = next.x - curr.x;
      let dy2 = next.y - curr.y;
      let len2 = Math.hypot(dx2, dy2) || 1;
      dx2 /= len2;
      dy2 /= len2;

      // outward normals per i due lati
      let nx1: number, ny1: number;
      let nx2: number, ny2: number;

      if (ccw) {
        // per CCW outward = (dy, -dx)
        nx1 = dy1;
        ny1 = -dx1;
        nx2 = dy2;
        ny2 = -dx2;
      } else {
        // per CW outward = (-dy, dx)
        nx1 = -dy1;
        ny1 = dx1;
        nx2 = -dy2;
        ny2 = dx2;
      }

      // media delle due normali (smussa vertice)
      let nx = nx1 + nx2;
      let ny = ny1 + ny2;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;

      // punto offset → offsetPx > 0 verso esterno, < 0 verso interno
      const ox = curr.x + nx * offsetPx;
      const oy = curr.y + ny * offsetPx;

      offsetPoints.push({ x: ox, y: oy });
    }

    if (offsetPoints.length < 3) return;

    g.lineStyle(lineWidth, color, alpha);
    g.moveTo(offsetPoints[0].x, offsetPoints[0].y);
    for (let i = 1; i < offsetPoints.length; i++) {
      g.lineTo(offsetPoints[i].x, offsetPoints[i].y);
    }
    g.lineTo(offsetPoints[0].x, offsetPoints[0].y);
  }

  // ---------------------------------------------------------
  // INNER SHADOW (bordo interno scuro sfumato)
  // ---------------------------------------------------------
  private renderShovelInnerShadow(shape: MultiPolygon): void {
    this.shovelInnerShadowGraphics.clear();
    if (!shape || shape.length === 0) return;

    const g = this.shovelInnerShadowGraphics;

    const steps = 4;
    const maxInset = 14;
    const baseInset = 4;

    const color = 0x000000;
    const lineWidth = 6;

    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length < 3) continue;

      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const offset = -(baseInset + t * maxInset); // NEGATIVO = verso l’interno
        const alpha = 0.22 * (1 - t);

        this.drawOffsetRing(g, outer, offset, color, alpha, lineWidth);
      }
    }
  }

  // ---------------------------------------------------------
  // BORDO FINALE (spesso + sottili offsettati)
  // ---------------------------------------------------------
  renderShovelBorder(shape: MultiPolygon): void {
    this.shovelBorderGraphics.clear();
    if (!shape || shape.length === 0) return;

    // prima inner shadow, poi bordo
    this.renderShovelInnerShadow(shape);

    const g = this.shovelBorderGraphics;

    // bordo principale spesso
    const borderWidth = 12;
    const borderColor = 0x2a1d0f;

    g.lineStyle(borderWidth, borderColor, 1.0);

    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length === 0) continue;

      // bordo esterno
      g.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
      g.lineTo(outer[0].x, outer[0].y);

      // bordi dei buchi
      if (poly.holes && poly.holes.length > 0) {
        for (const hole of poly.holes) {
          if (!hole || hole.length === 0) continue;
          g.moveTo(hole[0].x, hole[0].y);
          for (let i = 1; i < hole.length; i++) g.lineTo(hole[i].x, hole[i].y);
          g.lineTo(hole[0].x, hole[0].y);
        }
      }
    }

    // --- BORDI SOTTILI OFFSETTATI VERSO L'ESTERNO ---
    const thinColor = 0x000000;
    const thinWidth = 3;
    const ringCount = 5;
    const baseOffset = borderWidth * 1.8;
    const deltaOffset = 12;

    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length < 3) continue;

      for (let i = 0; i < ringCount; i++) {
        const off = baseOffset + deltaOffset * i;
        const alpha = 0.2 * (1 - i / ringCount);
        this.drawOffsetRing(g, outer, off, thinColor, alpha, thinWidth);
      }
    }
  }
}
