import * as PIXI from "pixi.js";

export class EditorControls {
  private canvas: HTMLCanvasElement;
  private world: PIXI.Container;

  // 🔹 niente più ctrl, usiamo solo pan con tasto centrale
  private isPanning = false;
  private lastPos = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, world: PIXI.Container) {
    this.canvas = canvas;
    this.world = world;

    // cursore di base mentre disegni
    this.canvas.style.cursor = "crosshair";

    this.initListeners();
  }

  private initListeners() {
    // ✅ PAN con click rotellina (button === 1)
    this.canvas.addEventListener("pointerdown", (e) => {
      // middle click
      if (e.button === 1) {
        e.preventDefault(); // evita l’autoscroll del browser
        this.isPanning = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = "crosshair";
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.isPanning) return;

      const dx = e.clientX - this.lastPos.x;
      const dy = e.clientY - this.lastPos.y;
      this.lastPos = { x: e.clientX, y: e.clientY };

      this.world.x += dx;
      this.world.y += dy;
    });
  }

  // usato in App.ts per capire se deve disegnare o no
  get isPanActive() {
    return this.isPanning;
  }
}
