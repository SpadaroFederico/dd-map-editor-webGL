import type { EditorState } from '../core/state';
import type { EditorRenderer } from '../rendering/renderer';
import type { ShovelTool } from '../core/tools/shovelTool';
import { TOOL_ID } from '../core/state';
import type { Point2D } from '../core/types';

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
    this.domElement.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    window.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    window.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (this.editorState.activeTool !== TOOL_ID.Shovel) return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    this.isDrawing = true;

    const firstStrokeShape = this.shovelTool.beginStroke(
      this.editorState,
      worldPos,
    );

    // reset layer stroke e disegna i primi timbri (preview)
    this.renderer.renderShovelStrokeInitial(firstStrokeShape);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;
    if (this.editorState.activeTool !== TOOL_ID.Shovel) return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const newStamps = this.shovelTool.moveStroke(this.editorState, worldPos);

    // aggiungi i nuovi stamp al layer stroke
    this.renderer.appendShovelStroke(newStamps);
  }

  private handleMouseUp(_e: MouseEvent): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.editorState.activeTool !== TOOL_ID.Shovel) return;

    // unione finale dello stroke
    this.shovelTool.endStroke(this.editorState);

    // pulizia preview
    this.renderer.clearShovelStroke();

    // shape unificata
    const finalShape = this.editorState.world.shovel.shape;

    // fill + bordo dalla shape consolidata
    this.renderer.renderShovelBase(finalShape);
    this.renderer.renderShovelBorder(finalShape);
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
