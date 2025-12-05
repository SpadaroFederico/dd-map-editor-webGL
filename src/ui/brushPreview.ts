// src/ui/brushPreview.ts
import * as PIXI from 'pixi.js';
import type { MultiPolygon } from '../core/types';

/**
 * Crea il canvas di preview + PIXI.Application + Container
 * con le stesse dimensioni e impostazioni che avevi in sidebar.ts.
 */
export function createPreviewCanvas(
  dpr: number,
): {
  canvas: HTMLCanvasElement;
  container: PIXI.Container;
  app: PIXI.Application;
} {
  const PREVIEW_LOGICAL_WIDTH = 260;
  const PREVIEW_LOGICAL_HEIGHT = 100;

  const canvas = document.createElement('canvas');
  canvas.className = 'tf-brush-preview-canvas';

  canvas.style.display = 'block';
  canvas.style.width = PREVIEW_LOGICAL_WIDTH + 'px';
  canvas.style.height = PREVIEW_LOGICAL_HEIGHT + 'px';

  canvas.width = PREVIEW_LOGICAL_WIDTH * dpr;
  canvas.height = PREVIEW_LOGICAL_HEIGHT * dpr;

  const app = new PIXI.Application({
    view: canvas,
    background: 0x0b0b0b,
    antialias: true,
    autoDensity: true,
    resolution: dpr,
  });
  app.renderer.resize(canvas.width, canvas.height);

  const container = new PIXI.Container();
  app.stage.addChild(container);

  return { canvas, container, app };
}

/**
 * Disegna un MultiPolygon su canvas/Container,
 * copiato 1:1 dalla versione originale in sidebar.ts.
 */
export function renderPolygonToCanvas(
  poly: MultiPolygon,
  canvas: HTMLCanvasElement,
  container: PIXI.Container,
  showBorder: boolean,
): void {
  container.removeChildren();

  const w = canvas.width;
  const h = canvas.height;
  const padding = 150;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of poly) {
    const rings = [p.outer, ...(p.holes ?? [])];
    for (const ring of rings) {
      if (!ring || !ring.length) continue;
      for (const pt of ring) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
  }

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return;

  const sx = (w - padding * 2) / width;
  const sy = (h - padding * 2) / height;
  const scale = Math.min(sx, sy);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const canvasCx = w / 2;
  const canvasCy = h / 2;

  let offsetX = canvasCx - cx * scale;
  let offsetY = canvasCy - cy * scale;

  const SHIFT_X = -110;
  const SHIFT_Y = -40;
  offsetX += SHIFT_X;
  offsetY += SHIFT_Y;

  const g = new PIXI.Graphics();
  g.lineStyle(2, 0xd4a831, 1);

  for (const p of poly) {
    const outer = p.outer;
    if (!outer || !outer.length) continue;

    g.moveTo(
      outer[0].x * scale + offsetX,
      outer[0].y * scale + offsetY,
    );
    for (let i = 1; i < outer.length; i++) {
      g.lineTo(
        outer[i].x * scale + offsetX,
        outer[i].y * scale + offsetY,
      );
    }
    g.lineTo(
      outer[0].x * scale + offsetX,
      outer[0].y * scale + offsetY,
    );
  }

  container.addChild(g);

  if (showBorder) {
    const m = new PIXI.Graphics();
    m.lineStyle(1, 0xffffff, 0.25);
    m.drawRect(0, 0, w, h);
    container.addChild(m);
  }
}
