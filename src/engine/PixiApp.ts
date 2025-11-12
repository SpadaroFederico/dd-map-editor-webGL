import { Application, Container, VERSION } from "pixi.js";

export class PixiApp {
  app: Application;
  world: Container;

  constructor(container: HTMLElement) {
    this.app = new Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: 1,
      autoDensity: true,
      powerPreference: "high-performance",
    });

    container.appendChild(this.app.renderer.view as unknown as HTMLCanvasElement);

    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);

    // Zoom iniziale + centratura
    const initialZoom = 0.5;
    this.world.scale.set(initialZoom);
    this.centerWorld();

    // 🔹 Eventi resize
    window.addEventListener("resize", () => this.onResize());

    console.log("PixiJS version:", VERSION);
  }

  private centerWorld() {
    const { width, height } = this.app.renderer;
    const bounds = this.world.getLocalBounds();
    this.world.x = width / 2 - bounds.width / 2 * this.world.scale.x;
    this.world.y = height / 2 - bounds.height / 2 * this.world.scale.y;
  }

  private onResize() {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.centerWorld();
  }
}
