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
  let currentRoughness = 10;
  let currentEdge = 20;
  let currentNoise = 10;
  let currentStroke: BrushStroke | null = null;

  // terreno base (livello inferiore)
  let currentBg: TileBackground | null = null;
  const generateBase = (type: "grass" | "dirt" | "water") => {
    if (currentBg) editor.world.removeChild(currentBg.container);
    currentBg = new TileBackground(editor.app, type, 64);
    editor.world.addChildAt(currentBg.container, 0);
  };
  generateBase("grass");

  // --- DISEGNO ---
  canvas.addEventListener("pointerdown", (e) => {
    if (controls.isPanActive) return;

    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const worldY = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;

    currentStroke = new BrushStroke(editor.app, activeBrushType, brushSize);
    currentStroke.setShape(
  brushShape === "polygon" ? "blob" : "circle"
);
    currentStroke.setRoughness(currentRoughness);
    currentStroke.setNoise(currentNoise);

    editor.world.addChild(currentStroke.container);
    currentStroke.start();

    // disegna subito una macchia
    currentStroke.drawAt(worldX, worldY);
    drawing = true;
  });

  canvas.addEventListener("pointermove", (e: PointerEvent) => {
    if (!drawing || !currentStroke || controls.isPanActive) return;

    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const worldY = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;

    // disegna una macchia casuale lungo il movimento
    currentStroke.drawAt(worldX, worldY);
  });

  window.addEventListener("pointerup", () => {
    if (!currentStroke) return;
    currentStroke.stop();
    currentStroke = null;
    drawing = false;
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
    (baseType: "grass" | "dirt" | "water") => generateBase(baseType),
    (brushType: "grass" | "dirt" | "water") => (activeBrushType = brushType),
    (size: number) => (brushSize = size),
    (shape: "circle" | "square" | "polygon") => (brushShape = shape),
    (rough: number) => (currentRoughness = rough),
    (_edge: number) => (currentEdge = _edge), // edge per ora non usato nel blob
    (noise: number) => (currentNoise = noise)
  );
}
