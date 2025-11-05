import { PixiApp } from "../engine/PixiApp";
import { TileBackground } from "../engine/TileBackground";

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);

  // Crea lo sfondo tileato
  const bg = new TileBackground(editor.app, "grass", 128);
  editor.world.addChild(bg.container);

  // Recupera il canvas vero e proprio
  const canvas = editor.app.renderer.view as unknown as HTMLCanvasElement;

  // 🔹 Variabili di controllo per pan/zoom
  let isDragging = false;
  let lastPos = { x: 0, y: 0 };

  // --- PAN ---
  canvas.addEventListener("pointerdown", (e: PointerEvent) => {
    isDragging = true;
    lastPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  window.addEventListener("pointermove", (e: PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    lastPos = { x: e.clientX, y: e.clientY };

    editor.world.x += dx;
    editor.world.y += dy;
  });

  // --- ZOOM ---
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();

    const zoomFactor = 1.05;
    const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;

    const newScale = editor.world.scale.x * scaleChange;
    const clampedScale = Math.min(Math.max(newScale, 0.5), 3);

    editor.world.scale.set(clampedScale);
  });
}
