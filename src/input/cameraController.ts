import type { EditorState } from '../core/state';
import type { EditorRenderer } from '../rendering/renderer';

export interface CameraConfig {
  minScale: number;
  maxScale: number;
  zoomSpeed: number;
}

export class CameraController {
  private editorState: EditorState;
  private renderer: EditorRenderer;
  private domElement: HTMLElement;
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };
  private config: CameraConfig;

  constructor(
    editorState: EditorState,
    renderer: EditorRenderer,
    domElement: HTMLElement,
    config?: Partial<CameraConfig>,
  ) {
    this.editorState = editorState;
    this.renderer = renderer;
    this.domElement = domElement;

    this.config = {
      minScale: 0.1,
      maxScale: 3,
      zoomSpeed: 1.1,
      ...(config ?? {}),
    };

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

    this.domElement.addEventListener(
      'wheel',
      (e) => {
        this.handleWheel(e);
      },
      { passive: false },
    );

    this.domElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;

    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;
    this.lastMouse = { x: e.clientX, y: e.clientY };

    this.editorState.cameraOffset.x += dx;
    this.editorState.cameraOffset.y += dy;

    this.renderer.updateCamera();
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isPanning = false;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const { minScale, maxScale, zoomSpeed } = this.config;
    const oldScale = this.editorState.cameraScale;

    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale =
      direction > 0 ? oldScale * zoomSpeed : oldScale / zoomSpeed;

    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    if (newScale === oldScale) return;

    const rect = this.domElement.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldX =
      (screenX - this.editorState.cameraOffset.x) / oldScale;
    const worldY =
      (screenY - this.editorState.cameraOffset.y) / oldScale;

    this.editorState.cameraScale = newScale;

    this.editorState.cameraOffset.x = screenX - worldX * newScale;
    this.editorState.cameraOffset.y = screenY - worldY * newScale;

    this.renderer.updateCamera();
  }
}
