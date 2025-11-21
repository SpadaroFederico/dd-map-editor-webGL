// src/terrain/terrainArea.ts
import * as pcRaw from "polygon-clipping";

// Compat interop CJS/ESM
const pc: any = (pcRaw as any)?.default ?? pcRaw;

export type Vec2 = [number, number];
export type Ring = Vec2[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

// Clone
function cloneMP(mp: MultiPolygon): MultiPolygon {
  return mp.map(poly =>
    poly.map(ring => ring.map(p => [p[0], p[1]] as Vec2))
  );
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

// Normalize
function toMultiPolygon(input: Polygon | MultiPolygon): MultiPolygon {
  if (
    Array.isArray(input) &&
    Array.isArray(input[0]) &&
    Array.isArray((input as any)[0][0]) &&
    Array.isArray((input as any)[0][0][0])
  ) {
    return input as MultiPolygon;
  }
  if (
    Array.isArray(input) &&
    Array.isArray((input as any)[0]) &&
    Array.isArray((input as any)[0][0]) &&
    typeof (input as any)[0][0][0] === "number"
  ) {
    return [input as Polygon];
  }
  throw new Error("Invalid polygon format");
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

  // 👉 OGNI STAMP VIENE AGGIUNTO COME POLIGONO SEPARATO
  //    (NON SI FA UNION — risolve i buchi/blobs)
  addStamp(stamp: Polygon | MultiPolygon) {
    const mpAdd = toMultiPolygon(stamp);
    this.mp.push(...cloneMP(mpAdd));
  }

  eraseStamp(stamp: Polygon | MultiPolygon) {
    if (this.mp.length === 0) return;

    const sub = toMultiPolygon(stamp);
    const res = pc.difference(this.mp, sub) as MultiPolygon;
    this.mp = filterTiny(res);
  }
}
