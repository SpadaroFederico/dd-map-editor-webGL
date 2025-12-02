import type { BrushSettings } from './state';
import type { LinearRing } from './types';
import {
  getStampDefinitionForRoughness,
  stampCoordsToRing,
} from './stampLibrary';

export interface BrushStamp {
  outline: LinearRing; // blob centrato in (0,0)
  radius: number;
}

export interface BrushEngine {
  makeStamp(settings: BrushSettings): BrushStamp;
  spacingFromSettings(settings: BrushSettings): number;
}

function makeCircleRing(radius: number, segments: number = 32): LinearRing {
  const ring: LinearRing = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push({
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius,
    });
  }
  return ring;
}

function makeSquareRing(radius: number): LinearRing {
  const r = radius;
  const ring: LinearRing = [
    { x: -r, y: -r },
    { x:  r, y: -r },
    { x:  r, y:  r },
    { x: -r, y:  r },
  ];
  return ring;
}


export const StampBrushEngine: BrushEngine = {
  makeStamp(settings: BrushSettings): BrushStamp {
    const radius = settings.size / 2;
    let outline: LinearRing;

    const shape = (settings as any).shape ?? 'polygon';

    if (shape === 'circle') {
      outline = makeCircleRing(radius);
    } else if (shape === 'square') {
      outline = makeSquareRing(radius);
    } else {
      // polygon: usa la definizione frastagliata basata su roughness
      const def = getStampDefinitionForRoughness(settings.roughness);
      outline = stampCoordsToRing(def.coords, radius);
    }

    return { outline, radius };
  },

  spacingFromSettings(settings: BrushSettings): number {
    const size = settings.size;

    // qui poi possiamo tarare spacing diverso per square (tipo size, per andare tile-per-tile)
    const spacing = 300;

    console.log('[Brush] size =', size, 'spacing =', spacing);

    return spacing;
  },
};
