import * as PIXI from "pixi.js";
import { TileBackground } from "./TileBackground";

export class BrushStroke {
  public container: PIXI.Container;
  public active = false;
  public brushSize = 32;
  public roughness = 0.4;
  public noise = 0.5;
  public brushShape: "circle" | "blob" | "angular" = "circle";

  private app: PIXI.Application;
  private terrain: TileBackground;
  private maskTexture: PIXI.RenderTexture;
  private maskSprite: PIXI.Sprite;
  private graphics: PIXI.Graphics;

  constructor(app: PIXI.Application, terrainType: string, size = 32) {
    this.app = app;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();

    // terreno
    this.terrain = new TileBackground(app, terrainType as any, 64);

    // texture maschera cumulativa
    this.maskTexture = PIXI.RenderTexture.create({
      width: app.renderer.width,
      height: app.renderer.height,
    });
    this.maskSprite = new PIXI.Sprite(this.maskTexture);

    this.terrain.container.mask = this.maskSprite;
    this.container.addChild(this.terrain.container);
    this.container.addChild(this.maskSprite);

    this.brushSize = size;
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  setShape(shape: "circle" | "blob" | "angular") {
    this.brushShape = shape;
  }

  setRoughness(value: number) {
    this.roughness = Math.max(0, Math.min(1, value / 100));
  }

  setNoise(value: number) {
    this.noise = Math.max(0, Math.min(1, value / 100));
  }

  drawAt(x: number, y: number) {
    if (!this.active) return;

    this.graphics.clear();
    this.graphics.beginFill(0xffffff, 1);

    switch (this.brushShape) {
      case "circle":
        this.graphics.drawCircle(x, y, this.brushSize / 2);
        break;
      case "blob":
        this.drawBlob(x, y, this.brushSize);
        break;
      case "angular":
        this.drawAngular(x, y, this.brushSize);
        break;
    }

    this.graphics.endFill();

    // disegna subito nella texture
    this.app.renderer.render(this.graphics, {
      renderTexture: this.maskTexture,
      clear: false,
    });
  }

  /** 🔹 Forma tipo blob morbido */
  private drawBlob(x: number, y: number, size: number) {
    const points: number[] = [];
    const numPoints = 10 + Math.floor(Math.random() * 6);
    const angleStep = (Math.PI * 2) / numPoints;
    const radius = size / 2;
    const rough = radius * this.roughness;
    const noise = this.noise * radius;

    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      const offset = Math.sin(i * 1.7) * rough + (Math.random() - 0.5) * noise;
      const r = radius + offset;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      points.push(px, py);
    }

    this.graphics.drawPolygon(points);
  }

  /** 🔸 Forma spigolosa con numero e orientamento casuale */
  private drawAngular(x: number, y: number, size: number) {
    const points: number[] = [];

    const numSides = 4 + Math.floor(Math.random() * 5); // 4–8 lati
    const baseRadius = size / 2;
    const rotation = Math.random() * Math.PI * 2;
    const irregularity = this.roughness * 0.6 * baseRadius; // spigolosità controllata

    for (let i = 0; i < numSides; i++) {
      const angle = rotation + (i / numSides) * Math.PI * 2;
      const r = baseRadius + (Math.random() - 0.5) * irregularity;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      points.push(px, py);
    }

    this.graphics.drawPolygon(points);
  }
}
