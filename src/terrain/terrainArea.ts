// src/terrain/terrainArea.ts
// Stato vettoriale dell'area esposta (MultiPolygon) con union/difference.
// Import robusto di polygon-clipping (compatibile CJS/ESM).

import * as pcRaw from "polygon-clipping";

// Compat interop: alcune build espongono default, altre named
const pc: any = (pcRaw as any)?.default ?? pcRaw;

export type Vec2 = [number, number];
export type Ring = Vec2[];            // contorno chiuso: ultimo punto NON ripetuto
export type Polygon = Ring[];         // [outer, ...holes]
export type MultiPolygon = Polygon[]; // multi-poligono

function cloneMP(mp: MultiPolygon): MultiPolygon {
  return mp.map((poly) => poly.map((ring) => ring.map((p) => [p[0], p[1]] as Vec2)));
}

function polygonArea(ring: Ring): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    s += (xj + xi) * (yj - yi);
  }
  return s / 2;
}

function filterTiny(mp: MultiPolygon, minArea = 1e-2): MultiPolygon {
  const out: MultiPolygon = [];
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const area = Math.abs(polygonArea(outer));
    if (area >= minArea) out.push(poly);
  }
  return out;
}

function toMultiPolygon(input: Polygon | MultiPolygon): MultiPolygon {
  // MultiPolygon?
  if (
    Array.isArray(input) &&
    Array.isArray(input[0]) &&
    Array.isArray((input as any)[0][0]) &&
    Array.isArray((input as any)[0][0][0])
  ) {
    return input as MultiPolygon;
  }
  // Polygon?
  if (
    Array.isArray(input) &&
    Array.isArray((input as any)[0]) &&
    Array.isArray((input as any)[0][0]) &&
    typeof (input as any)[0][0][0] === "number"
  ) {
    return [input as Polygon];
  }
  throw new Error("Invalid polygon format for union/difference");
}

export class TerrainArea {
  private mp: MultiPolygon = [];

  get geometry(): MultiPolygon {
    return cloneMP(this.mp);
  }

  set geometry(newMp: MultiPolygon) {
    this.mp = filterTiny(cloneMP(newMp));
  }

  clear() {
    this.mp = [];
  }

  addStamp(stamp: Polygon | MultiPolygon) {
    const add = toMultiPolygon(stamp);
    if (this.mp.length === 0) {
      this.mp = filterTiny(cloneMP(add));
      return;
    }
    const res = pc.union(this.mp, add) as MultiPolygon;
    this.mp = filterTiny(res);
  }

  eraseStamp(stamp: Polygon | MultiPolygon) {
    if (this.mp.length === 0) return;
    const sub = toMultiPolygon(stamp);
    const res = pc.difference(this.mp, sub) as MultiPolygon;
    this.mp = filterTiny(res);
  }
}
