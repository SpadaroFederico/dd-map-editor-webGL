// src/app/App.ts
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

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);
  const canvas = editor.app.renderer.view as HTMLCanvasElement;

  // Miglioriamo performance: niente sort per zIndex (usiamo l'ordine di addChild)
  editor.world.sortableChildren = false;

  const controls = new EditorControls(canvas, editor.world);

  // --- REGISTRA IL TUO POLIGONO ---
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

  // --- SOLO LAYER DI SFONDO ---
  let currentBg: TileBackground | null = null;
  const mountBackground = (type: "grass" | "dirt" | "water") => {
    if (currentBg) {
      editor.world.removeChild(currentBg.container);
      currentBg = null;
    }
    currentBg = new TileBackground(editor.app, type, 64);
    editor.world.addChild(currentBg.container); // fondo
  };
  mountBackground("grass");

  // --- AREA & MESH (mesh nascosta; usiamo solo bordo) ---
  const area = new TerrainArea();
  const mesh = new TerrainMesh(editor.app, 1.25);
  editor.world.addChild(mesh.container);
  mesh.container.visible = false; // nessun fill, solo contorno

  // --- BORDO VIOLA ---
  const debug = new PIXI.Graphics();
  editor.world.addChild(debug);

  // === OVERLAY DEBUG TIMBRO CORRENTE ===
const debugStamp = new PIXI.Graphics();
editor.world.addChild(debugStamp);

// pannellino numerico
let debugInfo: any = null;
const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.left = "10px";
hud.style.bottom = "10px";
hud.style.padding = "8px 10px";
hud.style.background = "rgba(0,0,0,.55)";
hud.style.color = "#fff";
hud.style.font = "12px monospace";
hud.style.borderRadius = "6px";
hud.style.zIndex = "1000";
hud.style.pointerEvents = "none";
document.body.appendChild(hud);

function drawLastStampOverlay() {
  debugStamp.clear();
  if (!debugInfo) return;

  // punto corrente
  const p = debugInfo.p as Vec2;
  if (p) {
    debugStamp.lineStyle(0);
    debugStamp.beginFill(0xffff00, 0.8);
    debugStamp.drawCircle(p[0], p[1], 2.5);
    debugStamp.endFill();
  }

  // capsula attesa (solo raggio come feedback)
  if (debugInfo.prev) {
    const a = debugInfo.prev as Vec2;
    const b = debugInfo.p as Vec2;
    debugStamp.lineStyle(1, 0xffa500, 1);
    debugStamp.moveTo(a[0], a[1]);
    debugStamp.lineTo(b[0], b[1]);
    const r = debugInfo.capsuleRadius as number;
    debugStamp.lineStyle(0);
    debugStamp.beginFill(0xffa500, 0.25);
    debugStamp.drawCircle(a[0], a[1], r);
    debugStamp.drawCircle(b[0], b[1], r);
    debugStamp.endFill();
  }

  // HUD numerico
  const lines = [
    `scale(world)= ${ (debugInfo.worldScale as number).toFixed(2) }`,
    `spacingW= ${ (debugInfo.spacingWorld as number).toFixed(1) }`,
    `nextW= ${ (debugInfo.nextSpacingWorld as number).toFixed(1) }`,
    `accW= ${ (debugInfo.distAccWorld as number).toFixed(1) }`,
    `capsR= ${ (debugInfo.capsuleRadius as number).toFixed(1) }`,
    `rot= ${ (debugInfo.rotation as number).toFixed(2) }`,
  ];
  hud.innerText = lines.join("\n");
}


  // throttle del bordo (evita ridisegni multipli nella stessa frame)
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

    // 1) area consolidata (violetto pieno)
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

    // 2) anteprima della pennellata (tratteggiata/alpha bassa per distinguere)
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

  // Texture (in futuro, se riattivi il fill)
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

// --- BRUSH ENGINE: spaziatura in pixel (invariante allo zoom) ---
const brush = new BrushEngine({
  area,
  scale: brushScale,
  rotRange: [0, Math.PI * 2] as [number, number],
  accumulatePerStroke: true,
  useCapsule: true,

  // DIRADAMENTO REALE: in pixel schermo
  spacingPx: Math.max(14, 0.8 * brushSize),
  spacingJitter: 0.18,          // ±18%
  minStampIntervalMs: 0,
  getWorldScale: () => editor.world.scale.x,

  onChange: () => {
    scheduleDrawDebug(brush.getPreview());
  },

  // DEBUG: ogni timbro
  onDebug: (info) => {
    debugInfo = info;            // aggiorna pannello
    drawLastStampOverlay();      // disegna stamp + capsula
  },
});
brush.setMode("paint");

// aggiorna con la UI
new BrushSelector((size) => {
  brushSize = size;
  brushScale = brushSize / 64;
  brush.setScale(brushScale);
  brush.setSpacingPx(Math.max(14, 0.8 * brushSize)); // in pixel
  brush.setSpacingJitter(0.18);
});



  // world coords
  function worldFromEvent(e: PointerEvent): Vec2 {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const y = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;
    return [x, y];
  }

  // pointer
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

    // alla fine, UNA sola triangolazione (se un giorno riattivi la mesh)
    mesh.update(area.geometry);

    // ridisegna bordo consolidato
    scheduleDrawDebug(null);
  });

  // Zoom
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = editor.world.scale.x * scaleChange;
    const clampedScale = Math.min(Math.max(newScale, 0.5), 3);
    editor.world.scale.set(clampedScale);
  });

  // init
  mesh.update(area.geometry);   // prepara la mesh (anche se invisibile)
  drawDebug();
}
