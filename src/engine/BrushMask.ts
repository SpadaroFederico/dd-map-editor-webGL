import * as PIXI from "pixi.js";

export type BrushShape = "circle" | "square";

export class BrushMask {
  private app: PIXI.Application;
  private maskTexture: PIXI.RenderTexture;
  private maskSprite: PIXI.Sprite;
  private brushGraphics: PIXI.Graphics;
  private active = false;
  private brushType: BrushShape = "circle";
  public brushSize = 32;

  constructor(app: PIXI.Application, width: number, height: number, size = 32) {
    this.app = app;
    this.brushSize = size;

    this.maskTexture = PIXI.RenderTexture.create({ width, height });
    this.maskSprite = new PIXI.Sprite(this.maskTexture);
    this.brushGraphics = new PIXI.Graphics();

    this.clearMask();
  }

  get sprite(): PIXI.Sprite {
    return this.maskSprite;
  }

  clearMask() {
    this.app.renderer.render(new PIXI.Graphics(), {
      renderTexture: this.maskTexture,
      clear: true,
    });
  }

  setSize(size: number) {
    this.brushSize = size;
  }

  setBrushType(type: BrushShape) {
    this.brushType = type;
  }

  startDrawing() {
    this.active = true;
  }

  stopDrawing() {
    this.active = false;
  }

  drawAt(x: number, y: number) {
    if (!this.active) return;

    const radius = this.brushSize / 2;
    this.brushGraphics.clear();
    this.brushGraphics.beginFill(0xffffff, 1);

    switch (this.brushType) {
      case "circle":
        this.brushGraphics.drawCircle(x, y, radius);
        break;

      case "square": {
        const size = this.brushSize;
        const tileX = Math.floor(x / size) * size + size / 2;
        const tileY = Math.floor(y / size) * size + size / 2;
        this.brushGraphics.drawRect(tileX - size / 2, tileY - size / 2, size, size);
        break;
      }
    }

    this.brushGraphics.endFill();

    this.app.renderer.render(this.brushGraphics, {
      renderTexture: this.maskTexture,
      clear: false,
    });
  }
}
