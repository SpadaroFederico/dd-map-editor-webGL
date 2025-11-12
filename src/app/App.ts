import * as PIXI from "pixi.js";
import { PixiApp } from "../engine/PixiApp";
import { EditorControls } from "../engine/EditorControls";
import { TileBackground } from "../engine/TileBackground";
import { LayerSelector } from "../ui/LayerSelector";
import { BrushSelector } from "../ui/BrushSelector";

import { TerrainArea } from "../terrain/terrainArea";
import { TerrainMesh } from "../terrain/terrainMesh";
import { BrushEngine } from "../brush/brushEngine";

import { setStamps } from "../data/stamps";
import type { Polygon, Vec2, MultiPolygon } from "../terrain/terrainArea";

// --- SLIDER ROUGHNESS ---
import { getRoughnessPolygon } from "../data/roughnessStamps";

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);
  const canvas = editor.app.renderer.view as HTMLCanvasElement;
  let debugInfo: any = null;

  // Migliora performance: niente sort per zIndex
  editor.world.sortableChildren = false;

  const controls = new EditorControls(canvas, editor.world);

  // --- REGISTRA POLIGONO BASE ---
  function toRingFromFlat(
    flat: number[],
    scale = 128,
    translate: [number, number] = [0, 0]
  ): Vec2[] {
    if (flat.length % 2 !== 0) throw new Error("flat array length must be even");
    const ring: Vec2[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const x = flat[i] * scale + translate[0];
      const y = flat[i + 1] * scale + translate[1];
      ring.push([x, y]);
    }
    return ring;
  }

  const flat = [
    -0.5875,-0.815625,-0.475,-0.821875,-0.16875,-0.596875,0,-0.703125,
    0.28125,-0.603125,0.30625,-0.009375,0.0625,0.078125,-0.15625,0.378125,
    -0.3,0.396875,-0.6125,0.090625,-0.4625,-0.078125,-0.8375,-0.484375
  ];
  const ring = toRingFromFlat(flat, 128);
  const myFirstStamp: Polygon = [ring];
  setStamps([myFirstStamp]);

  // --- BACKGROUND ---
  let currentBg: TileBackground | null = null;
  const mountBackground = (type: "grass" | "dirt" | "water") => {
    if (currentBg) {
      editor.world.removeChild(currentBg.container);
      currentBg = null;
    }
    currentBg = new TileBackground(editor.app, type, 64);
    editor.world.addChild(currentBg.container);
  };
  mountBackground("grass");

  // --- AREA & MESH ---
  const area = new TerrainArea();
  const mesh = new TerrainMesh(editor.app, 1.25);
  editor.world.addChild(mesh.container);
  mesh.container.visible = false;

  // --- DEBUG BORDER ---
  const debug = new PIXI.Graphics();
  editor.world.addChild(debug);

  let debugQueued = false;
  function scheduleDrawDebug(preview: MultiPolygon | null = null) {
    if (debugQueued) return;
    debugQueued = true;
    requestAnimationFrame(() => {
      debugQueued = false;
      drawDebug(preview);
    });
  }

  function drawDebug(preview: MultiPolygon | null = null) {
    debug.clear();
    debug.lineStyle(2, 0xff00ff, 0.9);

    const mp = area.geometry;
    for (const poly of mp) {
      for (let r = 0; r < poly.length; r++) {
        const ring = poly[r];
        if (!ring || ring.length < 2) continue;
        debug.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) debug.lineTo(ring[i][0], ring[i][1]);
        debug.lineTo(ring[0][0], ring[0][1]);
      }
    }

    // anteprima tratteggiata
    if (preview && preview.length > 0) {
      debug.lineStyle(2, 0xff00ff, 0.45);
      for (const poly of preview) {
        for (let r = 0; r < poly.length; r++) {
          const ring = poly[r];
          if (!ring || ring.length < 2) continue;
          debug.moveTo(ring[0][0], ring[0][1]);
          for (let i = 1; i < ring.length; i++) debug.lineTo(ring[i][0], ring[i][1]);
          debug.lineTo(ring[0][0], ring[0][1]);
        }
      }
    }
  }

  async function setHighlightTexture(type: "grass" | "dirt" | "water") {
    const url =
      type === "dirt"
        ? "src/assets/tiles/dirt/dirt_stylized_rock_1.png"
        : `src/assets/tiles/${type}/${type}_1.png`;
    await mesh.setTextureFromUrl(url);
  }
  setHighlightTexture("grass");

  // --- UI ---
  new LayerSelector((type) => {
    mountBackground(type);
    setHighlightTexture(type);
  });

  let brushSize = 64;
  let brushScale = brushSize / 64;
  new BrushSelector((size) => {
    brushSize = size;
    brushScale = brushSize / 64;
    brush.setScale(brushScale);
  });

  // --- BRUSH ENGINE ---
  const brush = new BrushEngine({
    area,
    scale: brushScale,
    rotRange: [0, Math.PI * 2] as [number, number],
    accumulatePerStroke: true,
    useCapsule: false,
    spacing: Math.max(24, 1.4 * brushSize),
    spacingJitter: 0.22,
    onChange: () => {
      const preview = brush.getPreview();
      if (!preview) return;
      scheduleDrawDebug(preview);
    },
    onDebug: (info: any) => {
      debugInfo = info;
    },
  });
  brush.setMode("paint");

  // Crea lo slider
  const roughnessInput = document.createElement("input");
  roughnessInput.type = "range";
  roughnessInput.min = "1";
  roughnessInput.max = "32";
  roughnessInput.step = "1";
  roughnessInput.value = "32";
  roughnessInput.style.position = "absolute";
  roughnessInput.style.bottom = "16px";
  roughnessInput.style.left = "50%";
  roughnessInput.style.transform = "translateX(-50%)";
  roughnessInput.style.width = "300px";
  roughnessInput.style.zIndex = "10";
  document.body.appendChild(roughnessInput);

  // --- SLIDER BRUSH SIZE ---
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "16";
  sizeInput.max = "256";
  sizeInput.step = "8";
  sizeInput.value = brushSize.toString();
  sizeInput.style.position = "absolute";
  sizeInput.style.bottom = "48px";
  sizeInput.style.left = "50%";
  sizeInput.style.transform = "translateX(-50%)";
  sizeInput.style.width = "300px";
  sizeInput.style.zIndex = "10";
  document.body.appendChild(sizeInput);

  // Aggiorna la dimensione del brush in tempo reale
  sizeInput.addEventListener("input", () => {
    brushSize = parseInt(sizeInput.value, 10);
    brushScale = brushSize / 64; // stesso rapporto che usi attualmente
    brush.setScale(brushScale);
  });


// Aggiorna il poligono in base alla roughness
roughnessInput.addEventListener("input", () => {
  const level = parseInt(roughnessInput.value, 10);
  const newPoly = getRoughnessPolygon(level);
  setStamps([newPoly]);
  // Ridisegna preview
  const preview = brush.getPreview();
  if (preview) scheduleDrawDebug(preview);
});

  // --- POINTER ---
  function worldFromEvent(e: PointerEvent): Vec2 {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const y = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;
    return [x, y];
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (controls.isPanActive) return;
    brush.pointerDown(worldFromEvent(e));
  });
  canvas.addEventListener("pointermove", (e) => {
    if (controls.isPanActive) return;
    brush.pointerMove(worldFromEvent(e));
  });
  window.addEventListener("pointerup", () => {
    if (controls.isPanActive) return;
    brush.pointerUp();
    mesh.update(area.geometry);
    scheduleDrawDebug(null);
  });

  // --- ZOOM ---
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = editor.world.scale.x * scaleChange;
    const clampedScale = Math.min(Math.max(newScale, 0.1), 3); // 🔹 ora puoi zoomare molto di più out
    editor.world.scale.set(clampedScale);
  });

  // --- INIT ---
  mesh.update(area.geometry);
  drawDebug();
}
