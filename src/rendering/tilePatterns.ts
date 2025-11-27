// src/rendering/tilePatterns.ts

import type { TilePatternConfig } from '../core/types';

export interface TilePatternLayer {
  config: TilePatternConfig;
  getVariantIndex(i: number, j: number): number;
}

// hash deterministico da (seed, i, j) a intero
function hash2DToInt(seed: number, i: number, j: number): number {
  let x = seed ^ (i * 73856093) ^ (j * 19349663);
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function createTilePatternLayer(
  config: TilePatternConfig,
): TilePatternLayer {
  return {
    config,
    getVariantIndex(i: number, j: number): number {
      const n = config.variants.length;
      if (n === 0) return 0;

      const h = hash2DToInt(config.seed, i, j);
      const idx = h % n;

      // TODO: qui in futuro possiamo aggiungere logica per evitare ripetizioni immediate
      return idx;
    },
  };
}
