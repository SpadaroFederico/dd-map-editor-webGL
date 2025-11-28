import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Point2D } from './types';

export interface GeometryEngine {
  union(a: MultiPolygon, b: MultiPolygon): MultiPolygon;
  difference(a: MultiPolygon, b: MultiPolygon): MultiPolygon;
  simplify(shape: MultiPolygon, tolerance: number): MultiPolygon;
}

/**
 * Conversione dai nostri tipi → formato polygon-clipping e viceversa
 */

type PcPoint = [number, number];
type PcRing = PcPoint[];
type PcPolygon = PcRing[];
type PcMultiPolygon = PcPolygon[];

/**
 * Converte il nostro MultiPolygon nel formato di polygon-clipping:
 * MultiPolygon = { outer: Point2D[], holes?: Point2D[][] }[]
 * →
 * PcMultiPolygon = [ [ [x,y][], [x,y][], ... ], ... ]
 */
function toPcMulti(shape: MultiPolygon): PcMultiPolygon {
  const result: PcMultiPolygon = [];

  for (let p = 0; p < shape.length; p++) {
    const poly = shape[p];
    if (!poly.outer || poly.outer.length < 3) continue;

    const outerRing: PcRing = poly.outer.map((pt) => [pt.x, pt.y]);

    const rings: PcPolygon = [outerRing];

    if (poly.holes) {
      for (let h = 0; h < poly.holes.length; h++) {
        const hole = poly.holes[h];
        if (!hole || hole.length < 3) continue;
        rings.push(
          hole.map((pt) => [pt.x, pt.y]),
        );
      }
    }

    result.push(rings);
  }

  return result;
}

/**
 * Converte dal formato polygon-clipping al nostro MultiPolygon.
 */
function fromPcMulti(pc: PcMultiPolygon): MultiPolygon {
  const result: MultiPolygon = [];

  for (let p = 0; p < pc.length; p++) {
    const rings = pc[p];
    if (!rings || rings.length === 0) continue;

    const outerRingPc = rings[0];
    if (!outerRingPc || outerRingPc.length < 3) continue;

    const outer = outerRingPc.map<Point2D>((pt) => ({
      x: pt[0],
      y: pt[1],
    }));

    const holes: Point2D[][] = [];

    for (let r = 1; r < rings.length; r++) {
      const holePc = rings[r];
      if (!holePc || holePc.length < 3) continue;

      holes.push(
        holePc.map<Point2D>((pt) => ({
          x: pt[0],
          y: pt[1],
        })),
      );
    }

    const polygon: Polygon = {
      outer,
      holes: holes.length > 0 ? holes : undefined,
    };

    result.push(polygon);
  }

  return result;
}

/**
 * Engine reale basato su polygon-clipping.
 */
export const PolygonClippingGeometryEngine: GeometryEngine = {
  union(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
    const aPc = toPcMulti(a || []);
    const bPc = toPcMulti(b || []);

    if (aPc.length === 0 && bPc.length === 0) return [];
    if (aPc.length === 0) {
      // IMPORTANTE: passiamo comunque in union per normalizzare/union interna
      const res = polygonClipping.union(bPc) as PcMultiPolygon;
      return fromPcMulti(res);
    }
    if (bPc.length === 0) {
      const res = polygonClipping.union(aPc) as PcMultiPolygon;
      return fromPcMulti(res);
    }

    const res = polygonClipping.union(aPc, bPc) as PcMultiPolygon;
    return fromPcMulti(res);
  },

  difference(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
    const aPc = toPcMulti(a || []);
    const bPc = toPcMulti(b || []);

    if (aPc.length === 0) return [];
    if (bPc.length === 0) return a;

    const res = polygonClipping.difference(aPc, bPc) as PcMultiPolygon;
    return fromPcMulti(res);
  },

  // per ora niente semplificazione aggressiva
  simplify(shape: MultiPolygon, _tolerance: number): MultiPolygon {
    return shape;
  },
};

// ------------------------------------------------------------
// OFFSET POLIGONO (semplificato)
// ------------------------------------------------------------
export function buildOffsetPolygon(
  points: Point2D[],
  offset: number
): MultiPolygon {

  if (!points || points.length < 3) return [];

  // algoritmo naive: sposta ogni punto radialmente dall'origine del poligono
  let cx = 0, cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  const ring = points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    return {
      x: p.x + (dx / len) * offset,
      y: p.y + (dy / len) * offset
    };
  });

  return [
    {
      outer: ring
    }
  ];
}


/**
 * Vecchio engine “finto” — se ti serve altrove puoi lasciarlo,
 * ma per la shovel NON lo usiamo.
 */
export const DummyGeometryEngine: GeometryEngine = {
  union(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
    return [...(a || []), ...(b || [])];
  },

  difference(a: MultiPolygon, _b: MultiPolygon): MultiPolygon {
    // nessuna vera differenza: restituiamo A
    return [...(a || [])];
  },

  simplify(shape: MultiPolygon): MultiPolygon {
    return shape;
  },
};
