// src/app/App.ts
import * as PIXI from "pixi.js";
import { PixiApp } from "../engine/PixiApp";
import { EditorControls } from "../engine/EditorControls";
import { TileBackground } from "../engine/TileBackground";
import { LayerSelector } from "../ui/LayerSelector";
import { BrushSelector } from "../ui/BrushSelector"; // solo UI per la size, non dipinge

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);
  const canvas = editor.app.renderer.view as HTMLCanvasElement;

  // Panning con CTRL + drag
  new EditorControls(canvas, editor.world);

  // --- SOLO LAYER DI SFONDO ---
  let currentBg: TileBackground | null = null;

  const mountBackground = (type: "grass" | "dirt" | "water") => {
    if (currentBg) {
      editor.world.removeChild(currentBg.container);
      currentBg = null;
    }
    currentBg = new TileBackground(editor.app, type, 64);
    editor.world.addChildAt(currentBg.container, 0); // sempre alla base
  };

  // sfondo iniziale
  mountBackground("grass");

  // --- UI minimale ---
  // cambia il tipo di sfondo
  new LayerSelector((type) => {
    mountBackground(type);
  });

  // UI della misura pennello (per ora solo stato, non dipinge)
  let brushSize = 64;
  new BrushSelector((size) => {
    brushSize = size; // prepariamo lo stato per il prossimo step
  });

  // --- Zoom ---
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = editor.world.scale.x * scaleChange;
    const clampedScale = Math.min(Math.max(newScale, 0.5), 3);
    editor.world.scale.set(clampedScale);
  });

  // Nessuna pennellata, nessuna mask, nessuna sidebar.
}
