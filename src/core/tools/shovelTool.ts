// src/core/tools/shovelTool.ts

import type { EditorState } from '../state';
import type { BrushEngine } from '../brush';
import type { GeometryEngine } from '../geometry';
import type { MultiPolygon, Point2D, Polygon } from '../types';

interface StrokeState {
  lastStampPos: Point2D | null;
  acc: MultiPolygon | null; // tutti gli stamp dello stroke corrente
}

export class ShovelTool {
  private brushEngine: BrushEngine;
  private geometry: GeometryEngine;
  private stroke: StrokeState;

  constructor(brushEngine: BrushEngine, geometry: GeometryEngine) {
    this.brushEngine = brushEngine;
    this.geometry = geometry;

    this.stroke = {
      lastStampPos: null,
      acc: null,
    };
  }

  // ───────────────────────
  // INIZIO / MOVE / FINE
  // ───────────────────────

  beginStroke(editor: EditorState, worldPos: Point2D): MultiPolygon | null {
    this.stroke.lastStampPos = null;
    this.stroke.acc = null;
    return this.addStamps(editor, worldPos);
  }

  moveStroke(editor: EditorState, worldPos: Point2D): MultiPolygon | null {
    return this.addStamps(editor, worldPos);
  }

  endStroke(editor: EditorState): void {
    const acc = this.stroke.acc;
    if (!acc || acc.length === 0) {
      this.resetStroke();
      return;
    }

    // unifichiamo TUTTI i timbri dello stroke in una sola shape
    let unified: MultiPolygon = [acc[0]];
    for (let i = 1; i < acc.length; i++) {
      unified = this.geometry.union(unified, [acc[i]]);
    }

    // uniamo la pennellata unificata con la shape globale
    const merged = this.geometry.union(editor.world.shovel.shape, unified);
    editor.world.shovel.shape = this.geometry.simplify(merged, 1.0);

    this.resetStroke();
  }

  private resetStroke(): void {
    this.stroke.lastStampPos = null;
    this.stroke.acc = null;
  }

  // ───────────────────────
  // COSTRUZIONE STROKE
  // ───────────────────────

  private addStamps(
    editor: EditorState,
    worldPos: Point2D,
  ): MultiPolygon | null {
    const settings = editor.brush;
    const spacing = this.brushEngine.spacingFromSettings(settings);
    const last = this.stroke.lastStampPos;

    // primo timbro dello stroke
    if (!last) {
      const firstStamp = this.createStampAt(editor, worldPos);
      this.stroke.lastStampPos = { ...worldPos };
      this.stroke.acc = [...firstStamp];
      // la preview usa i poligoni nuovi (outer pieni)
      return firstStamp;
    }

    const dx = worldPos.x - last.x;
    const dy = worldPos.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < spacing) return null;

    const steps = Math.floor(dist / spacing);
    if (steps <= 0) return null;

    const newStamps: MultiPolygon = [];
    let lastPlaced = { ...last };

    for (let i = 1; i <= steps; i++) {
      const t = (spacing * i) / dist;
      const px = last.x + dx * t;
      const py = last.y + dy * t;
      const pos = { x: px, y: py };

      const stamp = this.createStampAt(editor, pos);
      newStamps.push(...stamp);
      lastPlaced = pos;
    }

    this.stroke.lastStampPos = lastPlaced;

    this.stroke.acc = [
      ...(this.stroke.acc || []),
      ...newStamps,
    ];

    return newStamps.length > 0 ? newStamps : null;
  }

  // ───────────────────────
  // CREAZIONE TIMBRO SINGOLO
  // ───────────────────────

  private createStampAt(
    editor: EditorState,
    worldPos: Point2D,
  ): MultiPolygon {
    const stamp = this.brushEngine.makeStamp(editor.brush);

    const polygon: Polygon = {
      outer: stamp.outline.map((pt) => ({
        x: pt.x + worldPos.x,
        y: pt.y + worldPos.y,
      })),
    };

    return [polygon];
  }
}
