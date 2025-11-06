import { Application, Container, VERSION } from "pixi.js";

export class PixiApp {
  app: Application;
  world: Container;

  constructor(container: HTMLElement) {
    this.app = new Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000, // sfondo nero
      antialias: true,
      resolution: 1,
      autoDensity: true,
      powerPreference: "high-performance",
    });

    container.appendChild(this.app.renderer.view as unknown as HTMLCanvasElement);

    this.world = new Container();
    this.app.stage.addChild(this.world);

    // Zoom iniziale + centratura
    const initialZoom = 0.8;
    this.world.scale.set(initialZoom);
    this.centerWorld();

    console.log("PixiJS version:", VERSION);
  }

  private centerWorld() {
    const { width, height } = this.app.renderer;
    this.world.x = width / 2 - (width * this.world.scale.x) / 2;
    this.world.y = height / 2 - (height * this.world.scale.y) / 2;
  }
}
