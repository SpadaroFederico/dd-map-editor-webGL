// src/rendering/shapeDrawUtils.ts
import * as PIXI from "pixi.js";
import type { MultiPolygon, Point2D } from "../core/types";

/**
 * Disegna un MultiPolygon su un PIXI.Graphics.
 * Copiato 1:1 da EditorRenderer.drawMultiPolygon
 */
export function drawMultiPolygon(
  g: PIXI.Graphics,
  shape: MultiPolygon,
): void {
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

/**
 * Calcola l'area orientata (signed area) di un ring.
 * Copiato 1:1 da EditorRenderer.computeSignedArea
 */
function computeSignedArea(ring: Point2D[]): number {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  return area * 0.5;
}

/**
 * Disegna un ring offsettato verso l'interno o l'esterno.
 * Copiato 1:1 da EditorRenderer.drawOffsetRing
 */
export function drawOffsetRing(
  g: PIXI.Graphics,
  ring: Point2D[],
  offsetPx: number,
  color: number,
  alpha: number,
  lineWidth: number,
): void {
  if (!ring || ring.length < 3) return;

  const n = ring.length;
  const ccw = computeSignedArea(ring) > 0;

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
