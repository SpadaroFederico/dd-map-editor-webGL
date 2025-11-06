import * as PIXI from "pixi.js";
import { TileBackground } from "./TileBackground";

export class BrushStroke {
  public container: PIXI.Container;
  private maskTexture: PIXI.RenderTexture;
  private maskSprite: PIXI.Sprite;
  private graphics: PIXI.Graphics;
  private terrain: TileBackground;
  public active = false;
  public brushSize = 32;

  constructor(app: PIXI.Application, terrainType: string, size = 32) {
    this.container = new PIXI.Container();
    this.maskTexture = PIXI.RenderTexture.create({ width: app.renderer.width, height: app.renderer.height });
    this.maskSprite = new PIXI.Sprite(this.maskTexture);
    this.graphics = new PIXI.Graphics();

    this.terrain = new TileBackground(app, terrainType as any, 64);
    this.terrain.container.mask = this.maskSprite;

    this.container.addChild(this.terrain.container);
    this.container.addChild(this.maskSprite);
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  drawAt(app: PIXI.Application, x: number, y: number) {
    if (!this.active) return;
    const r = this.brushSize / 2;
    this.graphics.clear();
    this.graphics.beginFill(0xffffff);
    this.graphics.drawCircle(x, y, r);
    this.graphics.endFill();
    app.renderer.render(this.graphics, { renderTexture: this.maskTexture, clear: false });
  }
}
