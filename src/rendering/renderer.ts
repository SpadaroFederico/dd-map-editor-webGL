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

import { MATERIAL_TILE_FILES } from "./materialTileFiles";
import { drawMultiPolygon, drawOffsetRing } from "./shapeDrawUtils";

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

  private tilesPerSide = 28;
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

  // PREVIEW SELEZIONE PAINT
  private paintSelectionGraphics: PIXI.Graphics;

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

    // 9) OVERLAY SELEZIONE PAINT (area bianca)
    this.paintSelectionGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.paintSelectionGraphics);

    // 10) MASK SHOVEL
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

    root.addChild(container);
    root.addChild(mask);

    const textures =
      this.materialTextures[materialId] ?? this.materialTextures["dirt"] ?? [];

    const n = textures.length;
    if (n > 0) {
      const t = this.dirtPattern.config.tileSize;
      const half = this.tilesPerSide / 2;

      for (let i = 0; i < this.tilesPerSide; i++) {
        for (let j = 0; j < this.tilesPerSide; j++) {
          const x = (i - half) * t;
          const y = (j - half) * t;

          // indice variante “stabile”
          const idx = this.dirtPattern.getVariantIndex(i, j);
          const tex = textures[idx % n];

          const sprite = new PIXI.Sprite(tex);

          // ---- ROTAZIONE CASUALE 0 / 90 / 180 / 270 ----
          const rand = this.dirtPattern.getVariantIndex(i + 397, j + 911);
          const rotSteps = rand % 4; // 0..3
          sprite.rotation = rotSteps * (Math.PI / 2);

          // ruotiamo intorno al centro della tile
          sprite.anchor.set(0.5);
          sprite.x = x + t / 2;
          sprite.y = y + t / 2;

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
    //    i poligoni complessi arrivano come MultiPolygon
    //    e vengono disegnati con paintPolygonStamp().
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
    if (!stroke || stroke.mode !== mode || stroke.materialId !== materialId) {
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

    if (!stroke || stroke.mode !== mode || stroke.materialId !== materialId) {
      stroke = this.createPaintStrokeLayer(mode, materialId);
      this.currentPaintStroke = stroke;
    }

    const { mask } = stroke;

    mask.beginFill(0xffffff, 1);
    drawMultiPolygon(mask, shape); // ✅ usa l’helper importato
    mask.endFill();
  }

  // ---------------------------------------------------------
  // Helper shape per fill (cerchio / quadrato / esagono)
  // ---------------------------------------------------------
  private makeBrushShapeRing(center: Point2D, radius: number): Point2D[] {
    const shape = (((this.editorState.brush as any).shape ??
      "circle") as "polygon" | "circle" | "square");

    const ring: Point2D[] = [];
    if (radius <= 0) return ring;

    if (shape === "square") {
      ring.push(
        { x: center.x - radius, y: center.y - radius },
        { x: center.x + radius, y: center.y - radius },
        { x: center.x + radius, y: center.y + radius },
        { x: center.x - radius, y: center.y + radius },
      );
      return ring;
    }

    // polygon = esagono regolare, circle = 32 segmenti
    const segments = shape === "polygon" ? 6 : 32;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      ring.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }
    return ring;
  }

  // Costruisce il MultiPolygon per il fill (inside / outline)
  private buildFillShape(
    fillType: "inside" | "outline",
    ringWidth: number,
  ): MultiPolygon | null {
    const radius = this.editorState.brush.size;
    if (radius <= 0) return null;

    const center: Point2D = { x: 0, y: 0 };
    const innerRing = this.makeBrushShapeRing(center, radius);
    if (innerRing.length < 3) return null;

    if (fillType === "inside" || ringWidth <= 0) {
      return [
        {
          outer: innerRing,
          holes: [],
        },
      ];
    }

    const scale = (radius + ringWidth) / radius;
    const outerRing: Point2D[] = innerRing.map((p) => ({
      x: center.x + (p.x - center.x) * scale,
      y: center.y + (p.y - center.y) * scale,
    }));

    return [
      {
        outer: outerRing,
        holes: [innerRing],
      },
    ];
  }

  // ---------------------------------------------------------
  // PREVIEW SELEZIONE PAINT (area bianca)
  // ---------------------------------------------------------
  public updatePaintSelectionPreview(
    fillType: "inside" | "outline",
    ringWidth: number,
  ): void {
    const poly = this.buildFillShape(fillType, ringWidth);
    const g = this.paintSelectionGraphics;
    g.clear();

    if (!poly) return;

    g.lineStyle(2, 0xffffff, 0.9);
    g.beginFill(0xffffff, 0.25);
    drawMultiPolygon(g, poly);
    g.endFill();
  }

  // Applica il fill sulla selezione corrente
  public applyPaintSelection(
    fillType: "inside" | "outline",
    ringWidth: number,
  ): void {
    const poly = this.buildFillShape(fillType, ringWidth);
    if (!poly) return;

    const mode = this.editorState.activePaintMode;
    const materialId = this.editorState.activeMaterial;

    const stroke = this.createPaintStrokeLayer(mode, materialId);
    const { mask } = stroke;

    mask.beginFill(0xffffff, 1);
    drawMultiPolygon(mask, poly);
    mask.endFill();

    // puliamo la preview
    this.paintSelectionGraphics.clear();
  }

  // ---------------------------------------------------------
  // FILL: riempi l'intera mappa con il materiale/layer correnti
  // ---------------------------------------------------------
  public fillPaintLayer(): void {
    const mode = this.editorState.activePaintMode;
    const materialId = this.editorState.activeMaterial;

    const stroke = this.createPaintStrokeLayer(mode, materialId);
    const { mask } = stroke;

    const t = this.dirtPattern.config.tileSize;
    const half = this.tilesPerSide / 2;

    const x0 = -half * t;
    const y0 = -half * t;
    const w = this.tilesPerSide * t;
    const h = this.tilesPerSide * t;

    mask.beginFill(0xffffff, 1);
    mask.drawRect(x0, y0, w, h);
    mask.endFill();
  }

  // mouseup → chiudiamo lo stroke corrente
  public endBackgroundPaintStroke(): void {
    this.currentPaintStroke = null;
  }

  // ---------------------------------------------------------
  // MASK BASE SHOVEL
  // ---------------------------------------------------------
  renderShovelBase(shape: MultiPolygon): void {
    this.shovelBaseMaskGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.shovelBaseMaskGraphics.beginFill(0xffffff, 1);
    drawMultiPolygon(this.shovelBaseMaskGraphics, shape);
    this.shovelBaseMaskGraphics.endFill();
  }

  // ---------------------------------------------------------
  // PREVIEW STROKE SHOVEL
  // ---------------------------------------------------------
  renderShovelStrokeInitial(shape: MultiPolygon | null): void {
    this.shovelStrokeMaskGraphics.clear();
    if (!shape || shape.length === 0) return;

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    drawMultiPolygon(this.shovelStrokeMaskGraphics, shape);
    this.shovelStrokeMaskGraphics.endFill();
  }

  appendShovelStroke(shape: MultiPolygon | null): void {
    if (!shape || shape.length === 0) return;

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    drawMultiPolygon(this.shovelStrokeMaskGraphics, shape);
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
    drawMultiPolygon(this.shovelGlowGraphics, shape);
    this.shovelGlowGraphics.endFill();
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

        drawOffsetRing(g, outer, offset, color, alpha, lineWidth);
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
        drawOffsetRing(g, outer, off, thinColor, alpha, thinWidth);
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
