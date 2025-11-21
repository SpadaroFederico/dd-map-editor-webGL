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
import type { Polygon, Vec2, MultiPolygon, Ring } from "../terrain/terrainArea";

import { getRoughnessPolygon } from "../data/roughnessStamps";

type FillType = "grass" | "dirt" | "water";
const FILL_TYPES: FillType[] = ["grass", "dirt", "water"];
let currentRoughness = 32; // valore iniziale dello slider

// ======================================================
// 🔥 SISTEMA A LAYER TEMPORALI (una pennellata = un layer)
// ======================================================

type StrokeLayer = {
  type: FillType;
  area: TerrainArea;
  mesh: TerrainMesh;
  sprite: PIXI.Sprite;
  brush: BrushEngine;
};

// lista di tutte le pennellate già fatte (in ordine temporale)
const strokeLayers: StrokeLayer[] = [];

// pennellata attualmente in corso
let currentStroke: StrokeLayer | null = null;

// tipo di terreno attualmente selezionato
let currentFillType: FillType = "grass";

// ------------------------------------------------------
// Spaziatura in base alla dimensione del brush e roughness
// ------------------------------------------------------
function spacingFromSize(size: number, roughness: number): number {
  const r = Math.max(1, Math.min(32, roughness));
  const roughFactor = 1 + (r - 16) / 40;

  let base: number;

  if (size <= 24) {
    base = size * 0.12;
  } else if (size <= 48) {
    base = size * 0.25;
  } else if (size <= 96) {
    base = size * 0.4;
  } else {
    base = size * 0.65;
  }

  const spacing = base / roughFactor;
  return Math.max(1, spacing);
}

export function startEditor(): void {
  const container = document.body;
  const editor = new PixiApp(container);
  const canvas = editor.app.renderer.view as HTMLCanvasElement;
  let debugInfo: any = null;
  let lastPaintPos: Vec2 | null = null;

  editor.world.sortableChildren = false;
  const controls = new EditorControls(canvas, editor.world);

  // --- POLIGONO BASE (roughness 32) ---
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
    -0.5875, -0.815625, -0.475, -0.821875, -0.16875, -0.596875, 0, -0.703125,
    0.28125, -0.603125, 0.30625, -0.009375, 0.0625, 0.078125, -0.15625,
    0.378125, -0.3, 0.396875, -0.6125, 0.090625, -0.4625, -0.078125, -0.8375,
    -0.484375,
  ];
  const ring = toRingFromFlat(flat, 128);
  const myFirstStamp: Polygon = [ring];
  setStamps([myFirstStamp]);

  // ========================================================
  // 🔥 RenderTexture per ogni terreno (grass/dirt/water)
  //    con pattern di TileBackground generato UNA VOLTA
  //    → ogni pennellata dello stesso terreno usa la stessa texture
  // ========================================================
  const worldSize = 2072; // deve combaciare con il tuo TileBackground

  const terrainTextures: Record<FillType, PIXI.RenderTexture> = {
    grass: PIXI.RenderTexture.create({ width: worldSize, height: worldSize }),
    dirt: PIXI.RenderTexture.create({ width: worldSize, height: worldSize }),
    water: PIXI.RenderTexture.create({ width: worldSize, height: worldSize }),
  };

  // --- BACKGROUND DI BASE (sotto a tutto) ---
  let baseBg: TileBackground | null = null;
  const mountBaseBackground = (type: FillType) => {
    if (baseBg) {
      editor.world.removeChild(baseBg.container);
      baseBg = null;
    }
    baseBg = new TileBackground(editor.app, type, 64);
    editor.world.addChildAt(baseBg.container, 0);
  };
  mountBaseBackground("grass");

  // ============================================================
  // 🔥 GENERIAMO LE TILEBACKGROUND UNA SOLA VOLTA PER TERRENO
  //    e le renderizziamo dentro le RenderTexture
  // ============================================================
  const tileBgForTexture: Record<FillType, TileBackground> = {
    grass: new TileBackground(editor.app, "grass", 64, worldSize),
    dirt: new TileBackground(editor.app, "dirt", 64, worldSize),
    water: new TileBackground(editor.app, "water", 64, worldSize),
  };

  const bakedTypes = new Set<FillType>();

  async function bakeTerrainTextures() {
    for (const type of FILL_TYPES) {
      const bg = tileBgForTexture[type];

      await bg.ready; // 🔥 aspetta il caricamento delle texture
      editor.app.renderer.render(bg.container, {
        renderTexture: terrainTextures[type],
      });
    }

    console.log("✔ Terrains baked!");
  }

  bakeTerrainTextures();


  // --- PARAMETRI BRUSH GLOBALI ---
  let brushSize = 64;
  let brushScale = brushSize / 64;

  // --- DEBUG = bordo / mask ---
  const debug = new PIXI.Graphics();
  editor.world.addChild(debug);

  let debugQueued = false;
  let maskEnabled = true;

  function scheduleDrawDebug(preview: MultiPolygon | null = null) {
    if (debugQueued) return;
    debugQueued = true;
    requestAnimationFrame(() => {
      debugQueued = false;
      drawDebug(preview);
    });
  }

  function drawMultiPolygon(mp: MultiPolygon) {
    for (const poly of mp) {
      const ring = poly[0];   // <<< ONLY OUTER RING

      if (!ring || ring.length < 2) continue;

      debug.moveTo(ring[0][0], ring[0][1]);

      for (let i = 1; i < ring.length; i++) {
        debug.lineTo(ring[i][0], ring[i][1]);
      }

      debug.lineTo(ring[0][0], ring[0][1]);
    }
  }

  // Disegna, con lo stile corrente, TUTTE le aree di tutte le pennellate (vecchie + corrente)
  function drawAllStrokeAreas() {
    for (const s of strokeLayers) {
      const mp = s.area.geometry;
      if (!mp || mp.length === 0) continue;
      drawMultiPolygon(mp);
    }
    if (currentStroke) {
      const mp = currentStroke.area.geometry;
      if (mp && mp.length > 0) drawMultiPolygon(mp);
    }
  }

  // ---------- OFFSET RING (verso l'esterno) ----------
  function offsetRing(ring: Ring, delta: number): Ring {
    const n = ring.length;
    if (!ring || n < 3) return ring;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      area += x1 * y2 - x2 * y1;
    }
    const orientation = area >= 0 ? 1 : -1;

    const out: Ring = [];

    for (let i = 0; i < n; i++) {
      const [px, py] = ring[(i - 1 + n) % n];
      const [cx, cy] = ring[i];
      const [nx, ny] = ring[(i + 1) % n];

      const vx1 = cx - px;
      const vy1 = cy - py;
      const vx2 = nx - cx;
      const vy2 = ny - cy;

      const len1 = Math.hypot(vx1, vy1) || 1;
      const len2 = Math.hypot(vx2, vy2) || 1;

      let n1x = -vy1 / len1;
      let n1y = vx1 / len1;
      let n2x = -vy2 / len2;
      let n2y = vx2 / len2;

      let mx = n1x + n2x;
      let my = n1y + n2y;
      const mlen = Math.hypot(mx, my) || 1;
      mx /= mlen;
      my /= mlen;

      const dir = -orientation;

      const ox = cx + mx * delta * dir;
      const oy = cy + my * delta * dir;
      out.push([ox, oy]);
    }

    return out;
  }

  function offsetPolygon(poly: Polygon, delta: number): Polygon {
    const out: Polygon = [];
    for (const ring of poly) {
      out.push(offsetRing(ring, delta));
    }
    return out;
  }

  function offsetMultiPolygon(mp: MultiPolygon, delta: number): MultiPolygon {
    const out: MultiPolygon = [];
    for (const poly of mp) {
      out.push(offsetPolygon(poly, delta));
    }
    return out;
  }

  function smoothRing(
    ring: Ring,
    iterations = 1,
    baseLambda = 0.6
  ): Ring {
    if (!ring || ring.length < 3) return ring;

    let out: Ring = ring.map(([x, y]) => [x, y]);

    const thresholdSoft = 70;
    const thresholdHard = 40;
    const maxExtraLambda = 0.45;
    const maxLambda = 0.95;

    const spikeAngle = 40;
    const spikeEdgeMax = 70;

    for (let it = 0; it < iterations; it++) {
      const cur = out;
      const next: Ring = [];
      const n = cur.length;

      for (let i = 0; i < n; i++) {
        const [x, y] = cur[i];
        const [px, py] = cur[(i - 1 + n) % n];
        const [nx, ny] = cur[(i + 1) % n];

        let vx1 = px - x;
        let vy1 = py - y;
        let vx2 = nx - x;
        let vy2 = ny - y;

        const len1 = Math.hypot(vx1, vy1);
        const len2 = Math.hypot(vx2, vy2);

        if (len1 < 1e-3 || len2 < 1e-3) {
          next.push([x, y]);
          continue;
        }

        vx1 /= len1;
        vy1 /= len1;
        vx2 /= len2;
        vy2 /= len2;

        let dot = vx1 * vx2 + vy1 * vy2;
        dot = Math.max(-1, Math.min(1, dot));
        const angleRad = Math.acos(dot);
        const angleDeg = (angleRad * 180) / Math.PI;

        // picchi estremi
        if (angleDeg < spikeAngle && Math.max(len1, len2) < spikeEdgeMax) {
          const mx = (px + nx) * 0.5;
          const my = (py + ny) * 0.5;
          next.push([mx, my]);
          continue;
        }

        if (angleDeg > thresholdSoft) {
          next.push([x, y]);
          continue;
        }

        let extraLambda = 0;
        if (angleDeg <= thresholdHard) {
          extraLambda = maxExtraLambda;
        } else {
          const t =
            (thresholdSoft - angleDeg) / (thresholdSoft - thresholdHard);
          extraLambda = maxExtraLambda * t;
        }

        let lambda = baseLambda + extraLambda;
        if (lambda > maxLambda) lambda = maxLambda;

        const mx = (px + nx) * 0.5;
        const my = (py + ny) * 0.5;

        const sx = x + (mx - x) * lambda;
        const sy = y + (my - y) * lambda;

        next.push([sx, sy]);
      }

      out = next;
    }

    return out;
  }

  function smoothPolygon(poly: Polygon, iterations = 1, lambda = 0.7): Polygon {
    const out: Polygon = [];
    for (const ring of poly) {
      out.push(smoothRing(ring, iterations, lambda));
    }
    return out;
  }

  function smoothMultiPolygon(
    mp: MultiPolygon,
    iterations = 1,
    lambda = 0.7
  ): MultiPolygon {
    const out: MultiPolygon = [];
    for (const poly of mp) {
      out.push(smoothPolygon(poly, iterations, lambda));
    }
    return out;
  }

  // Disegna tutte le aree (stroke) “gonfiate” verso l’esterno
  function drawOffsetStrokeAreas(delta: number) {
    const smallBrush = brushSize <= 32;

    const iterations = smallBrush ? 3 : 2;
    const lambda = smallBrush ? 0.8 : 0.6;

    const drawAreaOffset = (area: TerrainArea) => {
      const mp = area.geometry;
      if (!mp || mp.length === 0) return;

      const mpOff = offsetMultiPolygon(mp, delta);
      const mpSmooth = smoothMultiPolygon(mpOff, iterations, lambda);
      drawMultiPolygon(mpSmooth);
    };

    for (const s of strokeLayers) {
      drawAreaOffset(s.area);
    }
    if (currentStroke) drawAreaOffset(currentStroke.area);
  }

  function drawDebug(preview: MultiPolygon | null = null) {
    debug.clear();
    if (!maskEnabled) return;

    const baseStyle = {
      alignment: 0.5,
      join: PIXI.LINE_JOIN.ROUND,
      cap: PIXI.LINE_CAP.ROUND,
    } as const;

    const sizeFactor = Math.min(1, brushSize / 64);

    // 1) alone bianco adattivo
    const glowSteps = 4;
    const glowWidthScale = 0.45 + 0.55 * sizeFactor;
    const glowAlphaScale = 0.55 + 0.45 * sizeFactor;

    for (let i = 0; i < glowSteps; i++) {
      const t = i / (glowSteps - 1);

      const baseWidth = 24 - i * 4;
      const baseAlpha = 0.05 + 0.04 * (1 - t);

      const width = baseWidth * glowWidthScale;
      const alpha = baseAlpha * glowAlphaScale;

      debug.lineStyle({
        width,
        color: 0xf5f1e8,
        alpha,
        ...baseStyle,
      });
      drawAllStrokeAreas();
    }

    // 2) linee di profondità adattive
    const isTinyBrush = brushSize <= 32;

    const repeatCount = isTinyBrush ? 3 : 5;
    const deltaStep = isTinyBrush ? 3 : 4;
    const startDelta = isTinyBrush ? 5 : 8;

    for (let i = 0; i < repeatCount; i++) {
      const delta = startDelta + deltaStep * i;

      let lineAlpha =
        (isTinyBrush ? 0.35 : 0.45) - i * (isTinyBrush ? 0.05 : 0.06);
      if (lineAlpha < 0.1) lineAlpha = 0.1;

      debug.lineStyle({
        width: 1,
        color: 0x463120,
        alpha: lineAlpha,
        ...baseStyle,
      });

      drawOffsetStrokeAreas(delta);
    }

    // 3) bordo principale
    debug.lineStyle({
      width: 5,
      color: 0x2b1608,
      alpha: 1,
      ...baseStyle,
    });
    drawAllStrokeAreas();

    // 4) preview della pennellata
    if (preview && preview.length > 0) {
      debug.lineStyle({
        width: 4,
        color: 0x2b1608,
        alpha: 0.85,
        ...baseStyle,
      });
      drawMultiPolygon(preview);
    }
  }

  // ------------------------------------------------------
  // helper per creare un brush per una certa AREA (stroke)
  // ------------------------------------------------------
  function createBrushForStroke(area: TerrainArea): BrushEngine {
    return new BrushEngine({
      area,
      scale: brushScale,
      rotRange: [0, Math.PI * 2] as [number, number],
      accumulatePerStroke: true,
      useCapsule: false,
      spacing: spacingFromSize(brushSize, currentRoughness),
      spacingJitter: 0.22,
      onChange: () => {
        const preview = currentStroke?.brush.getPreview() || null;
        scheduleDrawDebug(preview);
      },
      onDebug: (info: any) => {
        debugInfo = info;
      },
    });
  }

  // ------------------------------------------------------
  // UI: selettore layer di sfondo (base)
  // ------------------------------------------------------
  new LayerSelector((type) => {
    mountBaseBackground(type);
  });

  // ------------------------------------------------------
  // UI: BrushSelector (select in alto a destra)
  // ------------------------------------------------------
  new BrushSelector((size) => {
    brushSize = size;
    brushScale = brushSize / 64;

    if (currentStroke) {
      currentStroke.brush.setScale(brushScale);
      currentStroke.brush.setSpacing(
        spacingFromSize(brushSize, currentRoughness)
      );
    }
  });

  // --- SLIDER ROUGHNESS ---
  const roughnessInput = document.createElement("input");
  roughnessInput.type = "range";
  roughnessInput.min = "1";
  roughnessInput.max = "32";
  roughnessInput.step = "1";
  roughnessInput.value = "32";
  roughnessInput.style.position = "fixed";
  roughnessInput.style.bottom = "16px";
  roughnessInput.style.left = "50%";
  roughnessInput.style.transform = "translateX(-50%)";
  roughnessInput.style.width = "300px";
  roughnessInput.style.zIndex = "9999";
  document.body.appendChild(roughnessInput);

  // --- SLIDER BRUSH SIZE (in basso) ---
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "16";
  sizeInput.max = "256";
  sizeInput.step = "8";
  sizeInput.value = brushSize.toString();
  sizeInput.style.position = "fixed";
  sizeInput.style.bottom = "48px";
  sizeInput.style.left = "50%";
  sizeInput.style.transform = "translateX(-50%)";
  sizeInput.style.width = "300px";
  sizeInput.style.zIndex = "9999";
  document.body.appendChild(sizeInput);

  sizeInput.addEventListener("input", () => {
    brushSize = parseInt(sizeInput.value, 10);
    brushScale = brushSize / 64;

    if (currentStroke) {
      currentStroke.brush.setScale(brushScale);
      currentStroke.brush.setSpacing(
        spacingFromSize(brushSize, currentRoughness)
      );
    }
  });

  // --- SELECT TIPO DI TILE PER IL FILL ---
  const fillSelect = document.createElement("select");
  fillSelect.style.position = "fixed";
  fillSelect.style.top = "16px";
  fillSelect.style.left = "50%";
  fillSelect.style.transform = "translateX(-50%)";
  fillSelect.style.zIndex = "9999";

  const fillOptions: Array<[FillType, string]> = [
    ["grass", "Fill: Grass"],
    ["dirt", "Fill: Dirt"],
    ["water", "Fill: Water"],
  ];

  for (const [value, label] of fillOptions) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    fillSelect.appendChild(opt);
  }
  fillSelect.value = "grass";
  document.body.appendChild(fillSelect);

  fillSelect.addEventListener("change", () => {
    currentFillType = fillSelect.value as FillType;
    scheduleDrawDebug(null);
  });

  // --- TOGGLE "MASK" ---
  const maskContainer = document.createElement("div");
  maskContainer.style.position = "fixed";
  maskContainer.style.top = "16px";
  maskContainer.style.left = "16px";
  maskContainer.style.zIndex = "9999";
  maskContainer.style.color = "#ffffff";
  maskContainer.style.fontFamily = "sans-serif";
  maskContainer.style.fontSize = "14px";
  maskContainer.style.background = "rgba(0,0,0,0.4)";
  maskContainer.style.padding = "4px 8px";
  maskContainer.style.borderRadius = "4px";

  const maskCheckbox = document.createElement("input");
  maskCheckbox.type = "checkbox";
  maskCheckbox.id = "maskToggle";

  const maskLabel = document.createElement("label");
  maskLabel.htmlFor = "maskToggle";
  maskLabel.textContent = " Mask";

  maskContainer.appendChild(maskCheckbox);
  maskContainer.appendChild(maskLabel);
  document.body.appendChild(maskContainer);

  maskCheckbox.checked = true;
  maskEnabled = true;
  scheduleDrawDebug(null);

  maskCheckbox.addEventListener("change", () => {
    maskEnabled = maskCheckbox.checked;
    scheduleDrawDebug(null);
  });

  // --- Roughness change ---
  roughnessInput.addEventListener("input", () => {
    const level = parseInt(roughnessInput.value, 10);
    currentRoughness = level;

    const newPoly = getRoughnessPolygon(level);
    setStamps([newPoly]);

    if (currentStroke) {
      currentStroke.brush.setSpacing(
        spacingFromSize(brushSize, currentRoughness)
      );
    }

    const preview = currentStroke?.brush.getPreview() || null;
    if (preview) scheduleDrawDebug(preview);
    else scheduleDrawDebug(null);
  });

  // --- POINTER UTIL ---
  function worldFromEvent(e: PointerEvent): Vec2 {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const y = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;
    return [x, y];
  }

  // crea una nuova pennellata (stroke) e il relativo layer
  function beginStroke(pos: Vec2) {
    const type = currentFillType;

    const area = new TerrainArea();
    const mesh = new TerrainMesh(editor.app, 1.25);

    // sprite che usa la RenderTexture del terreno selezionato
    const sprite = new PIXI.Sprite(terrainTextures[type]);
    sprite.x = 0;
    sprite.y = 0;
    // se serve, puoi regolare anchor/position in base al tuo mondo
    // sprite.anchor.set(0.5);

    sprite.mask = mesh.mask;

    // ordine: baseBg sotto, poi tutte le stroke, poi debug sopra
    editor.world.addChild(sprite);
    editor.world.addChild(mesh.container);
    editor.world.addChild(debug); // rimetti il debug in cima

    const brush = createBrushForStroke(area);

    currentStroke = {
      type,
      area,
      mesh,
      sprite,
      brush,
    };

    brush.pointerDown(pos);
  }

  function strokeMove(pos: Vec2) {
    if (!currentStroke) return;

    if (!lastPaintPos) {
      lastPaintPos = pos;
      currentStroke.brush.pointerMove(pos);
      return;
    }

    const [lx, ly] = lastPaintPos;
    const dx = pos[0] - lx;
    const dy = pos[1] - ly;
    const dist = Math.hypot(dx, dy);

    const maxStep = Math.max(4, brushSize * 0.35);

    if (dist <= maxStep) {
      currentStroke.brush.pointerMove(pos);
      lastPaintPos = pos;
      return;
    }

    const steps = Math.ceil(dist / maxStep);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = lx + dx * t;
      const y = ly + dy * t;
      currentStroke.brush.pointerMove([x, y]);
    }
    lastPaintPos = pos;
  }

  function endStroke() {
    if (!currentStroke) return;

    currentStroke.brush.pointerUp();
    currentStroke.mesh.update(currentStroke.area.geometry);

    strokeLayers.push(currentStroke);
    currentStroke = null;
    lastPaintPos = null;

    scheduleDrawDebug(null);
  }

  // --- EVENTI POINTER ---
  canvas.addEventListener("pointerdown", (e) => {
    if (controls.isPanActive) return;
    const p = worldFromEvent(e);
    lastPaintPos = p;
    beginStroke(p);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (controls.isPanActive) return;
    if (!currentStroke) return;
    const p = worldFromEvent(e);
    strokeMove(p);
  });

  window.addEventListener("pointerup", () => {
    if (controls.isPanActive) return;
    endStroke();
  });

  // --- ZOOM ---
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const scaleChange = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = editor.world.scale.x * scaleChange;
    const clampedScale = Math.min(Math.max(newScale, 0.1), 3);
    editor.world.scale.set(clampedScale);
  });

  // --- INIT ---
  drawDebug();
}
