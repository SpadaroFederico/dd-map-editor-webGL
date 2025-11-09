// src/data/stamps.ts
// Registry + utility per gestire gli "stamp" (poligoni) del brush.
// Puoi caricare i tuoi 32 poligoni da file esterni e registrarli con setStamps().
// Espone funzioni per ottenere uno stamp random e trasformarlo (trasla/ruota/scala).

import type { Vec2, Ring, Polygon } from "../terrain/terrainArea";

/** Utils base */
function cloneRing(r: Ring): Ring {
  return r.map(([x, y]) => [x, y] as Vec2);
}
function clonePolygon(p: Polygon): Polygon {
  return p.map(r => cloneRing(r));
}

/** Chiudi eventuali ring se hanno primo == ultimo punto (non serve per earcut) */
function stripClosingPoint(r: Ring): Ring {
  if (r.length > 1) {
    const a = r[0], b = r[r.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return r.slice(0, -1);
  }
  return r;
}

/** Calcola il baricentro dell’outer (grezzo, sufficiente per brush) */
function centroid(r: Ring): Vec2 {
  let x = 0, y = 0;
  for (const p of r) { x += p[0]; y += p[1]; }
  const n = r.length || 1;
  return [x / n, y / n];
}

/** Applica T * R * S ai punti (origine = (0,0) locale del poligono) */
function transformRing(
  r: Ring,
  opts: { translate?: Vec2; scale?: number; rotation?: number; around?: Vec2 }
): Ring {
  const t = opts.translate ?? [0, 0];
  const s = opts.scale ?? 1;
  const rot = opts.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const origin = opts.around ?? [0, 0];

  const out: Ring = [];
  for (const [x, y] of r) {
    // porta il punto intorno all'origine richiesta
    const lx = (x - origin[0]) * s;
    const ly = (y - origin[1]) * s;
    // rotazione
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    // traslazione finale
    out.push([rx + origin[0] + t[0], ry + origin[1] + t[1]]);
  }
  return out;
}

/** Trasforma tutto il poligono (outer + holes) */
export function transformStamp(
  poly: Polygon,
  opts: { translate?: Vec2; scale?: number; rotation?: number; around?: "outer-centroid" | Vec2 }
): Polygon {
  const clean = poly.map(stripClosingPoint);
  const outer = clean[0] ?? [];
  let pivot: Vec2;
  if (Array.isArray(opts.around)) pivot = opts.around;
  else if (opts.around === "outer-centroid") pivot = centroid(outer);
  else pivot = [0, 0];

  return clean.map(r => transformRing(r, {
    translate: opts.translate,
    scale: opts.scale,
    rotation: opts.rotation,
    around: pivot,
  }));
}

/* ================== REGISTRO STAMP ================== */

let STAMPS: Polygon[] = [];

/** Sostituisce completamente la lista degli stamp */
export function setStamps(polys: Polygon[]) {
  STAMPS = polys.map(clonePolygon);
}

/** Aggiunge uno stamp singolo e ritorna il suo indice */
export function registerStamp(poly: Polygon): number {
  STAMPS.push(clonePolygon(poly));
  return STAMPS.length - 1;
}

/** Ritorna la lunghezza del registro */
export function stampCount(): number {
  return STAMPS.length;
}

/** Recupera per indice (clone) */
export function getStamp(i: number): Polygon {
  if (i < 0 || i >= STAMPS.length) throw new Error("stamp index out of range");
  return clonePolygon(STAMPS[i]);
}

/** Uno a caso (clone) */
export function getRandomStamp(): Polygon {
  if (STAMPS.length === 0) throw new Error("no stamps registered");
  const i = Math.floor(Math.random() * STAMPS.length);
  return clonePolygon(STAMPS[i]);
}

/* ============ Helper veloci per il brush ============ */

/** Comodo: prendi uno stamp random e trasformalo attorno al suo outer-centroid */
export function makeStampAt(
  pos: Vec2,
  opts?: { scale?: number; rotation?: number }
): Polygon {
  const base = getRandomStamp();
  return transformStamp(base, {
    translate: pos,
    scale: opts?.scale ?? 1,
    rotation: opts?.rotation ?? 0,
    around: "outer-centroid",
  });
}
