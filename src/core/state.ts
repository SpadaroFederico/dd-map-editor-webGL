// src/core/state.ts

import type { MaterialId, MultiPolygon } from './types';

// ToolId: tipo + costante
export const TOOL_ID = {
  Shovel: 'shovel',
  Paint: 'paint',
} as const;

export type ToolId = (typeof TOOL_ID)[keyof typeof TOOL_ID];

// PaintMode: tipo + costante
export const PAINT_MODE = {
  Background: 'background',
  Foreground: 'foreground',
  Top: 'top',
} as const;

export type PaintMode = (typeof PAINT_MODE)[keyof typeof PAINT_MODE];

// Parametri del brush
export interface BrushSettings {
  size: number;       // diametro in unità mondo (pixel per ora)
  roughness: number;  // 0..1 quanto è frastagliato il bordo
  spacing: number;    // distanza tra uno stamp e l'altro
}

// Stato shovel: la shape scavata
export interface ShovelState {
  shape: MultiPolygon;
}

// Stato di un singolo layer di paint per un materiale
export interface PaintLayerState {
  materialId: MaterialId;
  mask: MultiPolygon;       // geometria dove il materiale è visibile
}

// Tutti i layer di paint
export interface PaintState {
  background: PaintLayerState[];
  foreground: PaintLayerState[];
  top: PaintLayerState[];
}

// Stato del mondo logico (senza camera)
export interface WorldState {
  shovel: ShovelState;
  paint: PaintState;
}

// Stato complessivo dell'editor
export interface EditorState {
  world: WorldState;

  activeTool: ToolId;
  activePaintMode: PaintMode;
  activeMaterial: MaterialId;

  brush: BrushSettings;

  cameraScale: number;
  cameraOffset: { x: number; y: number };
}

// Factory per stato "vuoto"
export function createEmptyWorldState(): WorldState {
  return {
    shovel: { shape: [] },
    paint: {
      background: [],
      foreground: [],
      top: [],
    },
  };
}

// Stato iniziale di default dell'editor
export function createInitialEditorState(): EditorState {
  return {
    world: createEmptyWorldState(),
    activeTool: TOOL_ID.Shovel,
    activePaintMode: PAINT_MODE.Background,
    activeMaterial: 'grass',
    brush: {
      size: 900,
      roughness: 12,
      spacing: 40, // poi lo calcoliamo da size+roughness
    },
    cameraScale: 1,
    cameraOffset: { x: 0, y: 0 },
  };
}
