import { Application, Container, VERSION } from "pixi.js";

export class PixiApp {
  app: Application;
  world: Container;

  constructor(container: HTMLElement) {
    this.app = new Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      antialias: false,
      resolution: 1,
      autoDensity: true,
      powerPreference: "high-performance",
    });

    container.appendChild(this.app.renderer.view as unknown as HTMLCanvasElement);

    // Impostazioni extra per coerenza visiva
    this.app.renderer.background.color = [0, 0, 0];
    this.app.renderer.background.alpha = 1;
    this.app.renderer.background.clearBeforeRender = true;

    // Contenitore principale del mondo
    this.world = new Container();
    this.app.stage.addChild(this.world);

    console.log("PixiJS version:", VERSION);
  }
}
