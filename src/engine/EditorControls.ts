import * as PIXI from "pixi.js";

export class EditorControls {
  private canvas: HTMLCanvasElement;
  private world: PIXI.Container;
  private isDragging = false;
  private lastPos = { x: 0, y: 0 };
  private ctrlPressed = false;

  constructor(canvas: HTMLCanvasElement, world: PIXI.Container) {
    this.canvas = canvas;
    this.world = world;
    this.initListeners();
  }

  private initListeners() {
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && !this.ctrlPressed) {
        this.ctrlPressed = true;
        this.canvas.style.cursor = "grab";
      }
    });

    window.addEventListener("keyup", (e) => {
      if (!e.ctrlKey && this.ctrlPressed) {
        this.ctrlPressed = false;
        this.canvas.style.cursor = "crosshair";
      }
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.ctrlPressed && e.button === 0) {
        this.isDragging = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.ctrlPressed) this.canvas.style.cursor = "grab";
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (this.isDragging && this.ctrlPressed) {
        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.world.x += dx;
        this.world.y += dy;
      }
    });
  }

  get isPanActive() {
    return this.ctrlPressed;
  }
}
