// src/input/brushStrokeController.ts

import type { EditorState } from "../core/state";
import type { EditorRenderer } from "../rendering/renderer";
import type { ShovelTool } from "../core/tools/shovelTool";
import { TOOL_ID } from "../core/state";
import type { Point2D } from "../core/types";

export class BrushStrokeController {
  private editorState: EditorState;
  private renderer: EditorRenderer;
  private shovelTool: ShovelTool;
  private domElement: HTMLElement;

  private isDrawing = false;

  constructor(
    editorState: EditorState,
    renderer: EditorRenderer,
    shovelTool: ShovelTool,
    domElement: HTMLElement,
  ) {
    this.editorState = editorState;
    this.renderer = renderer;
    this.shovelTool = shovelTool;
    this.domElement = domElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.domElement.addEventListener("mousedown", (e) => {
      this.handleMouseDown(e);
    });

    window.addEventListener("mousemove", (e) => {
      this.handleMouseMove(e);
    });

    window.addEventListener("mouseup", (e) => {
      this.handleMouseUp(e);
    });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    this.isDrawing = true;

    // --------------------------------------------------
    // SHOVEL
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Shovel) {
      const firstStrokeShape = this.shovelTool.beginStroke(
        this.editorState,
        worldPos,
      );

      // reset layer stroke e disegna i primi timbri (preview)
      this.renderer.renderShovelStrokeInitial(firstStrokeShape);
      return;
    }

    // --------------------------------------------------
    // PAINT (Background / Foreground / Top)
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Paint) {
      const radius = this.editorState.brush.size / 2;

      // nuovo stroke → nuovo layer (dipende da activePaintMode)
      this.renderer.beginBackgroundPaintStroke();
      this.renderer.paintBackgroundDot(worldPos.x, worldPos.y, radius);
      return;
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);

    // --------------------------------------------------
    // SHOVEL
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Shovel) {
      const newStamps = this.shovelTool.moveStroke(this.editorState, worldPos);

      // aggiungi i nuovi stamp al layer stroke
      this.renderer.appendShovelStroke(newStamps);
      return;
    }

    // --------------------------------------------------
    // PAINT (qualsiasi modalità)
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Paint) {
      const radius = this.editorState.brush.size / 2;
      this.renderer.paintBackgroundDot(worldPos.x, worldPos.y, radius);
      return;
    }
  }

  private handleMouseUp(_e: MouseEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // --------------------------------------------------
    // SHOVEL: unione finale + redraw
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Shovel) {
      // unione finale
      this.shovelTool.endStroke(this.editorState);

      // pulizia preview
      this.renderer.clearShovelStroke();

      // shape finale consolidata
      const finalShape = this.editorState.world.shovel.shape;

      this.renderer.renderFullShovel(finalShape);
      return;
    }

    // --------------------------------------------------
    // PAINT: fine stroke → chiudiamo il layer corrente
    // --------------------------------------------------
    if (this.editorState.activeTool === TOOL_ID.Paint) {
      this.renderer.endBackgroundPaintStroke();
      return;
    }
  }

  private screenToWorld(clientX: number, clientY: number): Point2D {
    const rect = this.domElement.getBoundingClientRect();
    const xInCanvas = clientX - rect.left;
    const yInCanvas = clientY - rect.top;

    const scale = this.editorState.cameraScale;
    const offset = this.editorState.cameraOffset;

    return {
      x: (xInCanvas - offset.x) / scale,
      y: (yInCanvas - offset.y) / scale,
    };
  }
}
