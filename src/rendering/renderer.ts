// src/rendering/renderer.ts

import * as PIXI from 'pixi.js';
import type { EditorState } from '../core/state';
import type { TilePatternConfig, MultiPolygon } from '../core/types';
import type { ShovelTool } from '../core/tools/shovelTool';

import {
  createTilePatternLayer,
  type TilePatternLayer,
} from './tilePatterns';

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
  private dirtTextures: PIXI.Texture[] = [];
  private isInitialized = false;

  private tilesPerSide: number;
  private mapWidth: number;
  private mapHeight: number;

  // mask separata in due layer: base + stroke
  private shovelMaskContainer: PIXI.Container;
  private shovelBaseMaskGraphics: PIXI.Graphics;
  private shovelStrokeMaskGraphics: PIXI.Graphics;
  private shovelBorderGraphics: PIXI.Graphics;

  constructor(
    editorState: EditorState,
    shovelTool: ShovelTool,
    options?: EditorRendererOptions,
  ) {
    this.editorState = editorState;
    this.shovelTool = shovelTool;
    const canvas = options && options.canvas ? options.canvas : undefined;

    this.app = new PIXI.Application({
      view: canvas,
      resizeTo: window,
      antialias: true,
      background: 0x20252b,
    });

    // container mondo
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    // background
    this.backgroundTilesContainer = new PIXI.Container();
    this.worldContainer.addChild(this.backgroundTilesContainer);

    // layer shovel: pattern shovel + mask
    this.shovelFillContainer = new PIXI.Container();
    this.worldContainer.addChild(this.shovelFillContainer);

    // container mask con due graphics: base + stroke
    this.shovelMaskContainer = new PIXI.Container();
    this.shovelBaseMaskGraphics = new PIXI.Graphics();
    this.shovelStrokeMaskGraphics = new PIXI.Graphics();

    this.shovelMaskContainer.addChild(this.shovelBaseMaskGraphics);
    this.shovelMaskContainer.addChild(this.shovelStrokeMaskGraphics);

    this.worldContainer.addChild(this.shovelMaskContainer);
    this.shovelFillContainer.mask = this.shovelMaskContainer;

    // bordo sopra
    this.shovelBorderGraphics = new PIXI.Graphics();
    this.worldContainer.addChild(this.shovelBorderGraphics);

    this.tilesPerSide = 60;
    this.mapWidth = 0;
    this.mapHeight = 0;

    const dirtConfig: TilePatternConfig = {
      materialId: 'dirt',
      tileSize: 337,
      variants: [
        'dirt_1',
        'dirt_2',
        'dirt_3',
        'dirt_4',
        'dirt_5',
        'dirt_6',
        'dirt_7',
        'dirt_8',
        'dirt_9',
        'dirt_10',
        'dirt_11',
        'dirt_12',
        'dirt_13',
        'dirt_14',
        'dirt_15',
      ],
      seed: 12345,
    };

    this.dirtPattern = createTilePatternLayer(dirtConfig);
    this.computeMapSize();

    this.updateCamera();
  }

  async init(): Promise<void> {
    await this.loadDirtTextures();
    this.drawBackgroundFromPattern();
    this.drawShovelPatternFromPattern(); // pattern shovel sempre presente

    // mask base iniziale
    this.renderShovelBase(this.editorState.world.shovel.shape);
    this.renderShovelBorder(this.editorState.world.shovel.shape);

    this.fitCameraToMap();
    this.isInitialized = true;
  }

  updateCamera(): void {
    this.worldContainer.scale.set(this.editorState.cameraScale);
    this.worldContainer.position.set(
      this.editorState.cameraOffset.x,
      this.editorState.cameraOffset.y,
    );
  }

  private computeMapSize(): void {
    const tileSize = this.dirtPattern.config.tileSize;
    this.mapWidth = this.tilesPerSide * tileSize;
    this.mapHeight = this.tilesPerSide * tileSize;
  }

  private fitCameraToMap(): void {
    const rendererWidth = this.app.renderer.width;
    const rendererHeight = this.app.renderer.height;

    if (this.mapWidth <= 0 || this.mapHeight <= 0) {
      return;
    }

    const scaleX = rendererWidth / this.mapWidth;
    const scaleY = rendererHeight / this.mapHeight;

    let scale = scaleX < scaleY ? scaleX : scaleY;
    scale *= 0.9;

    this.editorState.cameraScale = scale;
    this.editorState.cameraOffset.x = rendererWidth / 2;
    this.editorState.cameraOffset.y = rendererHeight / 2;

    this.updateCamera();
  }

  private async loadDirtTextures(): Promise<void> {
    const promises: Promise<PIXI.Texture>[] = [];
    for (let i = 1; i <= 15; i++) {
      const path = `/tiles/dirt/dirt_stylized_rock_${i}.png`;
      promises.push(PIXI.Assets.load(path));
    }

    this.dirtTextures = await Promise.all(promises);

    if (this.dirtTextures.length === 0) {
      console.warn('Nessuna texture dirt caricata!');
    } else {
      console.log('Texture dirt caricate:', this.dirtTextures.length);
    }
  }

  // background globale
  private drawBackgroundFromPattern(): void {
    const tileSize = this.dirtPattern.config.tileSize;
    const tilesPerSide = this.tilesPerSide;
    const half = tilesPerSide / 2;
    const nTextures = this.dirtTextures.length;

    this.backgroundTilesContainer.removeChildren();

    for (let i = 0; i < tilesPerSide; i++) {
      for (let j = 0; j < tilesPerSide; j++) {
        const worldX = (i - half) * tileSize;
        const worldY = (j - half) * tileSize;

        const variantIndex = this.dirtPattern.getVariantIndex(i, j);

        let tex: PIXI.Texture | null = null;
        if (nTextures > 0) {
          tex = this.dirtTextures[variantIndex % nTextures];
        }

        if (tex) {
          const sprite = new PIXI.Sprite(tex);
          sprite.x = worldX;
          sprite.y = worldY;
          sprite.width = tileSize;
          sprite.height = tileSize;
          this.backgroundTilesContainer.addChild(sprite);
        } else {
          const g = new PIXI.Graphics();
          g.beginFill(0x6b4a2f);
          g.drawRect(worldX, worldY, tileSize, tileSize);
          g.endFill();
          this.backgroundTilesContainer.addChild(g);
        }
      }
    }

    // croce centrale
    const axis = new PIXI.Graphics();
    axis.lineStyle(2, 0xff5555, 1);
    axis.moveTo(-1000, 0);
    axis.lineTo(1000, 0);
    axis.moveTo(0, -1000);
    axis.lineTo(0, 1000);
    this.backgroundTilesContainer.addChild(axis);
  }

  // pattern shovel: stesso dirt ma tintato
  private drawShovelPatternFromPattern(): void {
    const tileSize = this.dirtPattern.config.tileSize;
    const tilesPerSide = this.tilesPerSide;
    const half = tilesPerSide / 2;
    const nTextures = this.dirtTextures.length;

    this.shovelFillContainer.removeChildren();

    for (let i = 0; i < tilesPerSide; i++) {
      for (let j = 0; j < tilesPerSide; j++) {
        const worldX = (i - half) * tileSize;
        const worldY = (j - half) * tileSize;

        const variantIndex = this.dirtPattern.getVariantIndex(i, j);

        let tex: PIXI.Texture | null = null;
        if (nTextures > 0) {
          tex = this.dirtTextures[variantIndex % nTextures];
        }

        if (tex) {
          const sprite = new PIXI.Sprite(tex);
          sprite.x = worldX;
          sprite.y = worldY;
          sprite.width = tileSize;
          sprite.height = tileSize;

          // TINT shovel
          sprite.tint = 0xaa7744;

          this.shovelFillContainer.addChild(sprite);
        } else {
          const g = new PIXI.Graphics();
          g.beginFill(0x543015);
          g.drawRect(worldX, worldY, tileSize, tileSize);
          g.endFill();
          this.shovelFillContainer.addChild(g);
        }
      }
    }
  }

  /**
   * Disegna MultiPolygon (outer + holes).
   * QUI usiamo beginHole/endHole così i buchi sono VERAMENTE vuoti.
   */
  private drawMultiPolygon(
    graphics: PIXI.Graphics,
    shape: MultiPolygon,
  ): void {
    for (let pIndex = 0; pIndex < shape.length; pIndex++) {
      const poly = shape[pIndex];
      const outer = poly.outer;
      if (!outer || outer.length === 0) {
        continue;
      }

      // anello esterno
      graphics.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) {
        graphics.lineTo(outer[i].x, outer[i].y);
      }
      graphics.lineTo(outer[0].x, outer[0].y);

      // buchi interni
      if (poly.holes && poly.holes.length > 0) {
        graphics.beginHole();
        for (let h = 0; h < poly.holes.length; h++) {
          const hole = poly.holes[h];
          if (!hole || hole.length === 0) continue;

          graphics.moveTo(hole[0].x, hole[0].y);
          for (let j = 1; j < hole.length; j++) {
            graphics.lineTo(hole[j].x, hole[j].y);
          }
          graphics.lineTo(hole[0].x, hole[0].y);
        }
        graphics.endHole();
      }
    }
  }

  /**
   * Disegna la shape consolidata (mask base).
   */
  renderShovelBase(shape: MultiPolygon): void {
    this.shovelBaseMaskGraphics.clear();

    if (!shape || shape.length === 0) {
      return;
    }

    this.shovelBaseMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelBaseMaskGraphics, shape);
    this.shovelBaseMaskGraphics.endFill();
  }

  /**
   * Primo pezzo di stroke (preview).
   */
  renderShovelStrokeInitial(strokeShape: MultiPolygon | null): void {
    this.shovelStrokeMaskGraphics.clear();

    if (!strokeShape || strokeShape.length === 0) {
      return;
    }

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelStrokeMaskGraphics, strokeShape);
    this.shovelStrokeMaskGraphics.endFill();
  }

  /**
   * Aggiunge nuovi timbri allo stroke (preview).
   */
  appendShovelStroke(stamps: MultiPolygon | null): void {
    if (!stamps || stamps.length === 0) {
      return;
    }

    this.shovelStrokeMaskGraphics.beginFill(0xffffff, 1);
    this.drawMultiPolygon(this.shovelStrokeMaskGraphics, stamps);
    this.shovelStrokeMaskGraphics.endFill();
  }

  /**
   * Bordo scuro della shovel sulla shape consolidata.
   */
  renderShovelBorder(shape: MultiPolygon): void {
    this.shovelBorderGraphics.clear();

    if (!shape || shape.length === 0) {
      return;
    }

    const borderWidth = 12;
    const borderColor = 0x2a1d0f;
    const borderAlpha = 1.0;

    this.shovelBorderGraphics.lineStyle(
      borderWidth,
      borderColor,
      borderAlpha,
    );

    for (let p = 0; p < shape.length; p++) {
      const poly = shape[p].outer;
      if (!poly || poly.length === 0) continue;

      this.shovelBorderGraphics.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        this.shovelBorderGraphics.lineTo(poly[i].x, poly[i].y);
      }
      this.shovelBorderGraphics.lineTo(poly[0].x, poly[0].y);
    }
  }

  /**
   * Pulisce completamente il layer stroke (quando lo stroke termina).
   */
  clearShovelStroke(): void {
    this.shovelStrokeMaskGraphics.clear();
  }
}
