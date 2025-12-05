// src/core/types.ts

// (lascia invariato ciò che già hai sopra)

export type MaterialId = 'grass' | 'dirt' | 'water' | 'reddungeon' | string;

export interface Point2D {
  x: number;
  y: number;
}

export type LinearRing = Point2D[];

export interface Polygon {
  outer: LinearRing;
  holes?: LinearRing[];
}

export type MultiPolygon = Polygon[];

// Config per un pattern di tiles di un materiale
export interface TilePatternConfig {
  materialId: MaterialId;
  tileSize: number;     // es. 64 o 128
  variants: string[];   // id logici delle varianti (anche solo nomi)
  seed: number;         // per random stabile
}
