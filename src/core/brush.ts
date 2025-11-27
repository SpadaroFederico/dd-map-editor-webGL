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

export const StampBrushEngine: BrushEngine = {
  makeStamp(settings: BrushSettings): BrushStamp {
    const radius = settings.size / 2;

    const def = getStampDefinitionForRoughness(settings.roughness);
    const outline = stampCoordsToRing(def.coords, radius);

    return { outline, radius };
  },

  spacingFromSettings(settings: BrushSettings): number {
    const size = settings.size;

    // Puoi tarare qui: per ora teniamo 300 come ti andava bene
    const spacing = 300;

    // Se ti dà fastidio, commenta pure il log
    console.log('[Brush] size =', size, 'spacing =', spacing);

    return spacing;
  },
};
