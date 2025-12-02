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
  // ROTAZIONE TIMBRO
  // ───────────────────────

  /** Angolo davvero casuale per ogni timbro (0–360°) */
  private computeStampRotation(_worldPos: Point2D): number {
    return Math.random() * 360;
  }

  /** Ruota l'outline locale del timbro attorno al suo centroide */
  private rotateOutline(
    outline: Point2D[],
    angleDeg: number,
  ): Point2D[] {
    if (!outline.length || angleDeg === 0) {
      // nessuna rotazione: ritorniamo una copia
      return outline.map((p) => ({ ...p }));
    }

    // centroide dell'outline
    let cx = 0;
    let cy = 0;
    for (const p of outline) {
      cx += p.x;
      cy += p.y;
    }
    cx /= outline.length;
    cy /= outline.length;

    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    return outline.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return {
        x: cx + dx * cosA - dy * sinA,
        y: cy + dx * sinA + dy * cosA,
      };
    });
  }

  // ───────────────────────
  // CREAZIONE TIMBRO SINGOLO
  // ───────────────────────

  private createStampAt(
    editor: EditorState,
    worldPos: Point2D,
  ): MultiPolygon {
    const stamp = this.brushEngine.makeStamp(editor.brush);

    // 1) angolo casuale per questo timbro
    const angle = this.computeStampRotation(worldPos);

    // 2) ruoto l'outline nel suo spazio locale
    const rotatedOutline = this.rotateOutline(stamp.outline, angle);

    // 3) poi traslo nel mondo
    const polygon: Polygon = {
      outer: rotatedOutline.map((pt) => ({
        x: pt.x + worldPos.x,
        y: pt.y + worldPos.y,
      })),
    };

    return [polygon];
  }

  // src/core/tools/shovelTool.ts

// src/core/tools/shovelTool.ts

  // ───────────────────────
  // PUBBLIC: crea un singolo stamp per il PAINT
  // ───────────────────────
  public createSingleStampPolygon(
    editor: EditorState,
    worldPos: Point2D
  ): MultiPolygon {
    return this.createStampAt(editor, worldPos);
  }

  // ───────────────────────
  // PREVIEW: stamp normalizzato in [-0.5, +0.5]
  // ───────────────────────
  public createTestStampPreview(editor: EditorState): MultiPolygon {
    const stamp = this.brushEngine.makeStamp(editor.brush);
    const outline = stamp.outline;
    if (!outline || !outline.length) return [];

    // bounding box del profilo locale
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of outline) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return [];
    }

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const maxSide = Math.max(width, height);

    // centro del bounding box
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // scala in modo che il lato massimo diventi 1.0
    // così i punti finiscono più o meno in [-0.5, +0.5]
    const scale = 1 / maxSide;

    const polygon: Polygon = {
      outer: outline.map((pt) => ({
        x: (pt.x - cx) * scale,  // intorno a 0
        y: (pt.y - cy) * scale,
      })),
    };

    return [polygon];
  }
}

