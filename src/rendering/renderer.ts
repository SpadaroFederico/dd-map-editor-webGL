// src/rendering/renderer.ts

import * as PIXI from "pixi.js";
import type { EditorState, PaintMode } from "../core/state";
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
const MATERIAL_TILE_FILES: Record<string, string[]> = {
  dirt: [
    "/tiles/dirt/dirt_stylized_rock_1.png",
    "/tiles/dirt/dirt_stylized_rock_2.png",
    "/tiles/dirt/dirt_stylized_rock_3.png",
    "/tiles/dirt/dirt_stylized_rock_4.png",
    "/tiles/dirt/dirt_stylized_rock_5.png",
    "/tiles/dirt/dirt_stylized_rock_6.png",
    "/tiles/dirt/dirt_stylized_rock_7.png",
    "/tiles/dirt/dirt_stylized_rock_8.png",
    "/tiles/dirt/dirt_stylized_rock_9.png",
    "/tiles/dirt/dirt_stylized_rock_10.png",
    "/tiles/dirt/dirt_stylized_rock_11.png",
    "/tiles/dirt/dirt_stylized_rock_12.png",
    "/tiles/dirt/dirt_stylized_rock_13.png",
    "/tiles/dirt/dirt_stylized_rock_14.png",
    "/tiles/dirt/dirt_stylized_rock_15.png",
  ],

  grass: [
    "/tiles/grass/grass_1.png",
    "/tiles/grass/grass_2.png",
    "/tiles/grass/grass_3.png",
    "/tiles/grass/grass_4.png",
    "/tiles/grass/grass_5.png",
    "/tiles/grass/grass_6.png",
    "/tiles/grass/grass_7.png",
    "/tiles/grass/grass_8.png",
    "/tiles/grass/grass_9.png",
    "/tiles/grass/grass_10.png",
    "/tiles/grass/grass_11.png",
    "/tiles/grass/grass_12.png",
    "/tiles/grass/grass_13.png",
    "/tiles/grass/grass_14.png",
    "/tiles/grass/grass_15.png",
  ],

  water: [
    "/tiles/water/water_1.png",
    "/tiles/water/water_2.png",
    "/tiles/water/water_3.png",
    "/tiles/water/water_4.png",
    "/tiles/water/water_5.png",
    "/tiles/water/water_6.png",
    "/tiles/water/water_7.png",
    "/tiles/water/water_8.png",
    "/tiles/water/water_9.png",
    "/tiles/water/water_10.png",
    "/tiles/water/water_11.png",
    "/tiles/water/water_12.png",
    "/tiles/water/water_13.png",
    "/tiles/water/water_14.png",
    "/tiles/water/water_15.png",
  ],
};

interface EditorRendererOptions {
  canvas?: HTMLCanvasElement;
}

type PaintStrokeLayer = {
  mode: PaintMode;
  materialId: MaterialId;
  container: PIXI.Container;
  mask: PIXI.Graphics;
};

export class EditorRenderer {
  app: PIXI.Application;
  worldContainer: PIXI.Container;
  backgroundTilesContainer: PIXI.Container;
  shovelFillContainer: PIXI.Container;

  private editorState: EditorState;
  private shovelTool: ShovelTool;
  private dirtPattern: TilePatternLayer;

  private materialTextures: Record<string, PIXI.Texture[]> = {};

  private dirtTextures: PIXI.Texture[] = [];
  private grassTextures: PIXI.Texture[] = [];

  private isInitialized = false;

  private tilesPerSide = 60;
  private mapWidth = 0;
  private mapHeight = 0;

  // MASK SHOVEL
  private shovelMaskContainer: PIXI.Container;
  private shovelBaseMaskGraphics: PIXI.Graphics;
  private shovelStrokeMaskGraphics: PIXI.Graphics;

  // PAINT: root per i 3 livelli
  private bgPaintRoot: PIXI.Container;
  private fgPaintRoot: PIXI.Container;
  private topPaintRoot: PIXI.Container;

  // stroke corrente (qualsiasi modalità: bg / fg / top)
  private currentPaintStroke: PaintStrokeLayer | null = null;

  // GLOW (alone bianco)
  private shovelGlowGraphics: PIXI.Graphics;

  // INNER SHADOW (bordo interno)
  private shovelInnerShadowGraphics: PIXI.Graphics;

  // BORDO FINALE
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

    // 2) LAYER PAINT BACKGROUND
    this.bgPaintRoot = new PIXI.Container();
    this.worldContainer.addChild(this.bgPaintRoot);

    // 3) GLOW SHOVEL
    this.shovelGlowGraphics = new PIXI.Graphics();
    this.shovelGlowGraphics.alpha = 0.4;
    this.shovelGlowGraphics.filters = [new BlurFilter(50)];
    this.worldContainer.addChild(this.shovelGlowGraphics);

    // 4) SHOVEL FILL
    this.shovelFillContainer = new PIXI.Container();
    this.worldContainer.addChild(this.shovelFillContainer);

    // 5) INNER SHADOW
    this.shovelInnerShadowGraphics = new PIXI.Graphics();
    this.shovelInnerShadowGraphics.alpha = 0.7;
    this.shovelInnerShadowGraphics.filters = [new BlurFilter(12)];
    this.worldContainer.addChild(this.shovelInnerShadowGraphics);

    // 6) BORDO SHOVEL
    this.shovelBorderGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.shovelBorderGraphics);

    // 7) LAYER PAINT FOREGROUND (sopra bordi shovel)
    this.fgPaintRoot = new PIXI.Container();
    this.worldContainer.addChild(this.fgPaintRoot);

    // 8) LAYER PAINT TOP (sopra tutto)
    this.topPaintRoot = new PIXI.Container();
    this.worldContainer.addChild(this.topPaintRoot);

    // 9) MASK SHOVEL
    this.shovelMaskContainer = new PIXI.Container();
    this.shovelBaseMaskGraphics = new PIXI.Graphics();
    this.shovelStrokeMaskGraphics = new PIXI.Graphics();

    this.shovelMaskContainer.addChild(this.shovelBaseMaskGraphics);
    this.shovelMaskContainer.addChild(this.shovelStrokeMaskGraphics);

    this.worldContainer.addChild(this.shovelMaskContainer);
    this.shovelFillContainer.mask = this.shovelMaskContainer;

    this.fgPaintRoot.mask = this.shovelMaskContainer;

    // Tile pattern terreno (dirt) per la mappa base
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
    this.drawShovelPatternFromPattern(); // layer di ERBA per la shovel

    const shape = this.editorState.world.shovel.shape;
    this.renderFullShovel(shape);

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

    this.dirtTextures = this.materialTextures["dirt"] ?? [];
    this.grassTextures = this.materialTextures["grass"] ?? [];
  }

  // ---------------------------------------------------------
  // BACKGROUND BASE
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

    // Croce debug
    const axis = new PIXI.Graphics();
    axis.lineStyle(2, 0xff5555, 1);
    axis.moveTo(-1000, 0);
    axis.lineTo(1000, 0);
    axis.moveTo(0, -1000);
    axis.lineTo(0, 1000);
    this.backgroundTilesContainer.addChild(axis);
  }

  // ---------------------------------------------------------
  // SHOVEL FILL (ERBA) – pattern indipendente dal background
  // ---------------------------------------------------------
  private drawShovelPatternFromPattern(): void {
    const t = this.dirtPattern.config.tileSize;
    const half = this.tilesPerSide / 2;

    const textures =
      (this.grassTextures && this.grassTextures.length > 0
        ? this.grassTextures
        : this.dirtTextures) ?? [];

    const n = textures.length;
    if (n === 0) return;

    this.shovelFillContainer.removeChildren();

    for (let i = 0; i < this.tilesPerSide; i++) {
      for (let j = 0; j < this.tilesPerSide; j++) {
        const x = (i - half) * t;
        const y = (j - half) * t;

        // offset per non avere lo stesso pattern del background
        const idx = this.dirtPattern.getVariantIndex(i + 1000, j + 2000);

        const tex = textures[idx % n];

        const s = new PIXI.Sprite(tex);
        s.x = x;
        s.y = y;
        s.width = t;
        s.height = t;

        this.shovelFillContainer.addChild(s);
      }
    }
  }

  // ---------------------------------------------------------
  // HELPERS PAINT (layer per stroke, per modalità)
  // ---------------------------------------------------------
  private getPaintRootForMode(mode: PaintMode): PIXI.Container {
    switch (mode) {
      case "foreground":
        return this.fgPaintRoot;
      case "top":
        return this.topPaintRoot;
      case "background":
      default:
        return this.bgPaintRoot;
    }
  }

  private createPaintStrokeLayer(
    mode: PaintMode,
    materialId: MaterialId,
  ): PaintStrokeLayer {
    const root = this.getPaintRootForMode(mode);

    const container = new PIXI.Container();
    const mask = new PIXI.Graphics();

    container.visible = true;
    container.mask = mask;

    // l’ordine: prima la texture, poi la mask
    root.addChild(container);
    root.addChild(mask);

    const textures =
      this.materialTextures[materialId] ??
      this.materialTextures["dirt"] ??
      [];

    const n = textures.length;
    if (n > 0) {
      const t = this.dirtPattern.config.tileSize;
      const half = this.tilesPerSide / 2;

      for (let i = 0; i < this.tilesPerSide; i++) {
        for (let j = 0; j < this.tilesPerSide; j++) {
          const x = (i - half) * t;
          const y = (j - half) * t;

          const idx = this.dirtPattern.getVariantIndex(i, j);
          const tex = textures[idx % n];

          const sprite = new PIXI.Sprite(tex);
          sprite.x = x;
          sprite.y = y;
          sprite.width = t;
          sprite.height = t;

          container.addChild(sprite);
        }
      }
    }

    return { mode, materialId, container, mask };
  }

  // chiamato a mousedown
public beginPaintStroke(): void {
    const mode = this.editorState.activePaintMode;
    const materialId = this.editorState.activeMaterial;

    this.currentPaintStroke = this.createPaintStrokeLayer(mode, materialId);
}

    // ---------------------------------------------------------
  // BRUSH SHAPES PER IL PAINT (polygon / circle / square)
  // ---------------------------------------------------------
  private drawBrushShape(
    g: PIXI.Graphics,
    x: number,
    y: number,
    radius: number,
  ): void {
    const shape = (((this.editorState.brush as any).shape ??
      "circle") as "polygon" | "circle" | "square");

    // 1) CERCHIO (default)
    if (shape === "circle") {
      g.drawCircle(x, y, radius);
      return;
    }

    // 2) QUADRATO (senza rotazioni, allineato agli assi)
    if (shape === "square") {
      const side = radius * 2;
      g.drawRect(x - radius, y - radius, side, side);
      return;
    }

    // 3) POLIGONO:
    //    NON lo disegniamo qui: i poligoni "seri"
    //    arrivano come MultiPolygon da stamps / stampLibrary
    //    e vengono disegnati con paintPolygonStamp().
    //    Qui non facciamo nulla per evitare di inventare un'altra forma.
  }


  // dot/stroke continuo per QUALSIASI modalità (bg/fg/top)
  public paintBackgroundDot(
    x: number,
    y: number,
    radius: number,
    _color: number = 0xffffff,
    _alpha: number = 1.0,
  ): void {
    const mode = this.editorState.activePaintMode;
    const materialId = this.editorState.activeMaterial;

    let stroke = this.currentPaintStroke;

    // se non c'è uno stroke corrente compatibile, ne creiamo uno nuovo
    if (
      !stroke ||
      stroke.mode !== mode ||
      stroke.materialId !== materialId
    ) {
      stroke = this.createPaintStrokeLayer(mode, materialId);
      this.currentPaintStroke = stroke;
    }

    const { mask } = stroke;

    mask.beginFill(0xffffff, 1);
    this.drawBrushShape(mask, x, y, radius);
    mask.endFill();
  }

    // ---------------------------------------------------------
  // PAINT POLYGON usando i MultiPolygon dei tuoi stamps
  // ---------------------------------------------------------
  public paintPolygonStamp(shape: MultiPolygon): void {
    if (!shape || !shape.length) return;

    const mode = this.editorState.activePaintMode;
    const materialId = this.editorState.activeMaterial;

    let stroke = this.currentPaintStroke;

    // se non c'è uno stroke corrente compatibile, ne creiamo uno nuovo
    if (
      !stroke ||
      stroke.mode !== mode ||
      stroke.materialId !== materialId
    ) {
      stroke = this.createPaintStrokeLayer(mode, materialId);
      this.currentPaintStroke = stroke;
    }

    const { mask } = stroke;

    mask.beginFill(0xffffff, 1);
    this.drawMultiPolygon(mask, shape);
    mask.endFill();
  }


  // mouseup → chiudiamo lo stroke corrente
  public endBackgroundPaintStroke(): void {
    this.currentPaintStroke = null;
  }

  // ---------------------------------------------------------
  // MULTIPOLYGON DRAWING
  // ---------------------------------------------------------
  private drawMultiPolygon(g: PIXI.Graphics, shape: MultiPolygon): void {
    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length === 0) continue;

      g.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
      g.lineTo(outer[0].x, outer[0].y);

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
  // UTILITY OFFSET BORDI
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

      let dx1 = curr.x - prev.x;
      let dy1 = curr.y - prev.y;
      let len1 = Math.hypot(dx1, dy1) || 1;
      dx1 /= len1;
      dy1 /= len1;

      let dx2 = next.x - curr.x;
      let dy2 = next.y - curr.y;
      let len2 = Math.hypot(dx2, dy2) || 1;
      dx2 /= len2;
      dy2 /= len2;

      let nx1: number, ny1: number;
      let nx2: number, ny2: number;

      if (ccw) {
        nx1 = dy1;
        ny1 = -dx1;
        nx2 = dy2;
        ny2 = -dx2;
      } else {
        nx1 = -dy1;
        ny1 = dx1;
        nx2 = -dy2;
        ny2 = dx2;
      }

      let nx = nx1 + nx2;
      let ny = ny1 + ny2;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;

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
  // INNER SHADOW
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
        const offset = -(baseInset + t * maxInset);
        const alpha = 0.22 * (1 - t);

        this.drawOffsetRing(g, outer, offset, color, alpha, lineWidth);
      }
    }
  }

  // ---------------------------------------------------------
  // BORDO FINALE
  // ---------------------------------------------------------
  renderShovelBorder(shape: MultiPolygon): void {
    this.shovelBorderGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.renderShovelInnerShadow(shape);

    const g = this.shovelBorderGraphics;

    const borderWidth = 12;
    const borderColor = 0x2a1d0f;

    g.lineStyle(borderWidth, borderColor, 1.0);

    for (const poly of shape) {
      const outer = poly.outer;
      if (!outer || outer.length === 0) continue;

      g.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
      g.lineTo(outer[0].x, outer[0].y);

      if (poly.holes && poly.holes.length > 0) {
        for (const hole of poly.holes) {
          if (!hole || hole.length === 0) continue;
          g.moveTo(hole[0].x, hole[0].y);
          for (let i = 1; i < hole.length; i++) g.lineTo(hole[i].x, hole[i].y);
          g.lineTo(hole[0].x, hole[0].y);
        }
      }
    }

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

  // ---------------------------------------------------------
  // RENDER COMPLETO SHOVEL
  // ---------------------------------------------------------
  public renderFullShovel(shape: MultiPolygon): void {
    if (!shape || shape.length === 0) return;

    this.renderShovelBase(shape);
    this.renderShovelEffects(shape);
    this.renderShovelBorder(shape);
  }
}
