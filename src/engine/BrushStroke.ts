import * as PIXI from "pixi.js";
import { TileBackground } from "./TileBackground";

export type BrushShape = "circle" | "square" | "polygon";

export class BrushStroke {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private terrain: TileBackground;
  public active = false;
  public brushSize = 32;
  public brushShape: BrushShape = "circle";

  constructor(app: PIXI.Application, terrainType: string, size = 32) {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();

    // background del terreno
    this.terrain = new TileBackground(app, terrainType as any, 64);

    // maschera locale (Graphics diretta)
    this.terrain.container.mask = this.graphics;

    // ordine di disegno: terreno + maschera
    this.container.addChild(this.terrain.container);
    this.container.addChild(this.graphics);

    this.brushSize = size;
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  setShape(shape: BrushShape) {
    this.brushShape = shape;
  }

  drawAt(app: PIXI.Application, x: number, y: number) {
    if (!this.active) return;
    const radius = this.brushSize / 2;

    this.graphics.beginFill(0xffffff, 1);

    switch (this.brushShape) {
      case "circle":
        this.graphics.drawCircle(x, y, radius);
        break;

      case "square":
        this.graphics.drawRect(x - radius, y - radius, this.brushSize, this.brushSize);
        break;

      case "polygon":
        this.drawRandomPolygon(x, y, radius);
        break;
    }

    this.graphics.endFill();
  }

/** Poligono casuale realistico */
private drawRandomPolygon(x: number, y: number, radius: number) {
  const minRadius = radius * 0.6;
  const maxRadius = radius * 1.2;
  const numPoints = 6 + Math.floor(Math.random() * 5); // 6–10 lati

  const points: number[] = [];
  const startAngle = Math.random() * Math.PI * 2;

  for (let i = 0; i < numPoints; i++) {
    const angle = startAngle + (i / numPoints) * Math.PI * 2;
    const r = minRadius + Math.random() * (maxRadius - minRadius);
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    points.push(px, py);
  }

  this.graphics.drawPolygon(points);
}


}
