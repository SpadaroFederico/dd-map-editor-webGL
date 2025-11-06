import { PixiApp } from "../engine/PixiApp";
import { EditorControls } from "../engine/EditorControls";
import { Sidebar } from "../ui/Sidebar";
import { BrushStroke } from "../engine/BrushStroke";
import { TileBackground } from "../engine/TileBackground";

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);

  const canvas = editor.app.renderer.view as HTMLCanvasElement;
  const controls = new EditorControls(canvas, editor.world);

  let drawing = false;
  let activeBrushType: "grass" | "dirt" | "water" = "dirt";
  let brushSize = 32;
  let brushShape: "circle" | "square" | "polygon" = "circle";
  let currentStroke: BrushStroke | null = null;

  // terreno base (solo visivo sotto tutto)
  let currentBg: TileBackground | null = null;
  const generateBase = (type: "grass" | "dirt" | "water") => {
    const prevPos = currentBg
      ? { x: currentBg.container.x, y: currentBg.container.y }
      : { x: 0, y: 0 };

    if (currentBg) editor.world.removeChild(currentBg.container);

    currentBg = new TileBackground(editor.app, type, 64);
    editor.world.addChildAt(currentBg.container, 0);
    currentBg.container.x = prevPos.x;
    currentBg.container.y = prevPos.y;
  };

  generateBase("grass");

  // --- GESTIONE DISEGNO ---
  canvas.addEventListener("pointerdown", () => {
    if (controls.isPanActive) return;

    // crea una nuova pennellata per ogni click
    currentStroke = new BrushStroke(editor.app, activeBrushType, brushSize);
    currentStroke.setShape(brushShape);

    editor.world.addChild(currentStroke.container);
    currentStroke.start();
    drawing = true;
  });

  canvas.addEventListener("pointermove", (e: PointerEvent) => {
    if (!drawing || !currentStroke) return;

    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const worldY = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;

    // disegno fluido
    if (!(currentStroke as any).lastX) {
      (currentStroke as any).lastX = worldX;
      (currentStroke as any).lastY = worldY;
    }

    const lastX = (currentStroke as any).lastX;
    const lastY = (currentStroke as any).lastY;
    const dx = worldX - lastX;
    const dy = worldY - lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = currentStroke.brushSize / 2;

    for (let i = 0; i <= dist; i += step) {
      const x = lastX + (dx * i) / dist;
      const y = lastY + (dy * i) / dist;
      currentStroke.drawAt(editor.app, x, y);
    }

    (currentStroke as any).lastX = worldX;
    (currentStroke as any).lastY = worldY;
  });

  window.addEventListener("pointerup", () => {
    drawing = false;
    if (currentStroke) currentStroke.stop();
    if (currentStroke) {
      delete (currentStroke as any).lastX;
      delete (currentStroke as any).lastY;
    }
    currentStroke = null;
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

  // --- SIDEBAR ---
  new Sidebar(
    (baseType) => {
      generateBase(baseType);
    },
    (brushType) => {
      activeBrushType = brushType;
    },
    (size) => {
      brushSize = size;
    },
    (shape) => {
      brushShape = shape;
    },
    () => {
      // roughness callback rimossa, non serve più
    }
  );
}
