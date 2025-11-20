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

import { Sidebar } from "../ui/Sidebar";

type FillType = "grass" | "dirt" | "water";
const FILL_TYPES: FillType[] = ["grass", "dirt", "water"];
let currentRoughness = 32; // valore iniziale dello slider


  // Spaziatura in base alla dimensione del brush e alla roughness
  function spacingFromSize(size: number, roughness: number): number {
    // normalizziamo la roughness (1–32)
    const r = Math.max(1, Math.min(32, roughness));

    // più la roughness è alta, più stringiamo la spaziatura
    // (r=16 → factor ≈1, r=32 → factor ≈1.4)
    const roughFactor = 1 + (r - 16) / 40;

    let base: number;

    if (size <= 24) {
      // pennelli minuscoli: timbri quasi attaccati
      base = size * 0.12;              // es 16 → 1.9 px circa
    } else if (size <= 48) {
      base = size * 0.25;              // es 32 → 8 px
    } else if (size <= 96) {
      base = size * 0.4;               // es 64 → 25.6 px
    } else {
      // pennelloni grandi
      base = size * 0.65;
    }

    const spacing = base / roughFactor;

    // mai meno di 1px per evitare esagerazioni, ma molto fitto sui piccoli
    return Math.max(1, spacing);
  }



type FillLayer = {
  type: FillType;
  area: TerrainArea;
  mesh: TerrainMesh;
  bg: TileBackground;
  brush: BrushEngine;

  // 🔹 NUOVO: anteprima del fill
  previewMesh: TerrainMesh;
  previewBg: TileBackground;
};

export function startEditor(): void {
  const sidebar = new Sidebar();

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
    -0.5875,-0.815625,-0.475,-0.821875,-0.16875,-0.596875,0,-0.703125,
    0.28125,-0.603125,0.30625,-0.009375,0.0625,0.078125,-0.15625,0.378125,
    -0.3,0.396875,-0.6125,0.090625,-0.4625,-0.078125,-0.8375,-0.484375
  ];
  const ring = toRingFromFlat(flat, 128);
  const myFirstStamp: Polygon = [ring];
  setStamps([myFirstStamp]);

  // --- BACKGROUND DI BASE ---
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

  // --- LAYER DI FILL (uno per tipo) ---
  const fillLayers: Record<FillType, FillLayer> = {} as any;
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

  // Disegna tutti i ring di un MultiPolygon con lo stile corrente
  function drawMultiPolygon(mp: MultiPolygon) {
    for (const poly of mp) {
      for (let r = 0; r < poly.length; r++) {
        const ring = poly[r];
        if (!ring || ring.length < 2) continue;

        debug.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
          debug.lineTo(ring[i][0], ring[i][1]);
        }
        debug.lineTo(ring[0][0], ring[0][1]);
      }
    }
  }

    // Disegna, con lo stile corrente, TUTTE le aree dei layer di fill
  function drawAllFillAreas() {
    for (const type of FILL_TYPES) {
      const area = fillLayers[type]?.area;
      if (!area) continue;
      const mp = area.geometry;
      if (!mp || mp.length === 0) continue;
      drawMultiPolygon(mp);
    }
  }


  // crea tutti i layer di fill
  for (const type of FILL_TYPES) {
    const area = new TerrainArea();

    // mesh + bg "reali"
    const mesh = new TerrainMesh(editor.app, 1.25);
    const bg = new TileBackground(editor.app, type, 64);

    // 🔹 mesh + bg di ANTEPRIMA
    const previewMesh = new TerrainMesh(editor.app, 1.25);
    const previewBg = new TileBackground(editor.app, type, 64);
    previewBg.container.alpha = 0.7;    // un po' trasparente
    previewBg.container.visible = false; // nascosto di default

    // ordine nello stage:
    // baseBg (0) -> bg -> mesh (mask) -> previewBg -> previewMesh (mask)
    editor.world.addChild(bg.container);
    editor.world.addChild(mesh.container);

    editor.world.addChild(previewBg.container);
    editor.world.addChild(previewMesh.container);

    // maschere
    bg.container.mask = mesh.mask;
    previewBg.container.mask = previewMesh.mask;

    const brush = createBrushForArea(area);
    fillLayers[type] = {
      type,
      area,
      mesh,
      bg,
      brush,
      previewMesh,
      previewBg,
    };
  }

  // ---------- OFFSET RING (verso l'esterno) ----------
  function offsetRing(ring: Ring, delta: number): Ring {
    const n = ring.length;
    if (!ring || n < 3) return ring;

    // area firmata per sapere se è CW o CCW
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
      let n1y =  vx1 / len1;
      let n2x = -vy2 / len2;
      let n2y =  vx2 / len2;

      // normale media
      let mx = n1x + n2x;
      let my = n1y + n2y;
      const mlen = Math.hypot(mx, my) || 1;
      mx /= mlen;
      my /= mlen;

      // dir: verso esterno. Se per caso lo vedi ancora verso dentro,
      // cambia in "-orientation".
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

    // Soglie per smoothing "normale"
    const thresholdSoft = 70;   // sopra questo → niente smoothing
    const thresholdHard = 40;   // sotto questo → smoothing più forte
    const maxExtraLambda = 0.45;
    const maxLambda = 0.95;

    // Soglie per considerare un vertice un "picco" da collassare
    const spikeAngle = 40;      // angolo molto acuto
    const spikeEdgeMax = 70;    // segmenti abbastanza corti (px/py ↔ x/y ↔ nx/ny)

    for (let it = 0; it < iterations; it++) {
      const cur = out;
      const next: Ring = [];
      const n = cur.length;

      for (let i = 0; i < n; i++) {
        const [x, y] = cur[i];
        const [px, py] = cur[(i - 1 + n) % n];
        const [nx, ny] = cur[(i + 1) % n];

        // vettori verso i vicini
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

        // angolo tra i due lati
        let dot = vx1 * vx2 + vy1 * vy2;
        dot = Math.max(-1, Math.min(1, dot));
        const angleRad = Math.acos(dot);
        const angleDeg = (angleRad * 180) / Math.PI;

        // --- 1) PICCHI ESTREMI: collassa il punto sulla linea tra i vicini ---
        if (
          angleDeg < spikeAngle &&
          Math.max(len1, len2) < spikeEdgeMax
        ) {
          const mx = (px + nx) * 0.5;
          const my = (py + ny) * 0.5;
          next.push([mx, my]);
          continue;
        }

        // --- 2) Angoli normali: smoothing adattivo come prima ---
        if (angleDeg > thresholdSoft) {
          // angolo ampio → nessuna modifica
          next.push([x, y]);
          continue;
        }

        let extraLambda = 0;
        if (angleDeg <= thresholdHard) {
          extraLambda = maxExtraLambda; // molto stretto → max smoothing
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

  // Disegna tutti i fill layer ma “gonfiati” verso l’esterno di delta px,
  // applicando uno smoothing per arrotondare gli spigoli e ridurre sovrapposizioni.
  function drawOffsetFillAreas(delta: number) {
    const smallBrush = brushSize <= 32;      // heuristica: stai disegnando cose piccole

    // per figure piccole aumentiamo ancora lo smoothing
    const iterations = smallBrush ? 3 : 2;
    const lambda     = smallBrush ? 0.8 : 0.6;

    for (const type of FILL_TYPES) {
      const area = fillLayers[type]?.area;
      if (!area) continue;
      const mp = area.geometry;
      if (!mp || mp.length === 0) continue;

      const mpOff    = offsetMultiPolygon(mp, delta);
      const mpSmooth = smoothMultiPolygon(mpOff, iterations, lambda);

      drawMultiPolygon(mpSmooth);
    }
  }


  function drawDebug(preview: MultiPolygon | null = null) {
    debug.clear();
    if (!maskEnabled) return;

    const baseStyle = {
      alignment: 0.5,
      join: PIXI.LINE_JOIN.ROUND,
      cap: PIXI.LINE_CAP.ROUND,
    } as const;

    // fattore 0..1 in base alla grandezza del brush
    // es: size 16 → ~0.25, size 64+ → 1
    const sizeFactor = Math.min(1, brushSize / 64);

    // =====================================================
    // 1) ALONE BIANCO ADATTIVO (per evitare "macchie" sui piccoli)
    // =====================================================
    const glowSteps = 4;

    // brush piccoli → alone più stretto e meno intenso
    const glowWidthScale = 0.45 + 0.55 * sizeFactor;   // 0.45..1.0
    const glowAlphaScale = 0.55 + 0.45 * sizeFactor;   // 0.55..1.0

    for (let i = 0; i < glowSteps; i++) {
      const t = i / (glowSteps - 1);

      const baseWidth = 24 - i * 4;            // 24, 20, 16, 12
      const baseAlpha = 0.05 + 0.04 * (1 - t); // interno più intenso

      const width = baseWidth * glowWidthScale;
      const alpha = baseAlpha * glowAlphaScale;

      debug.lineStyle({
        width,
        color: 0xf5f1e8,  // bianco caldo
        alpha,
        ...baseStyle,
      });
      drawAllFillAreas();
    }

    // =====================================================
    // 2) LINEE DI PROFONDITÀ ADATTIVE
    //    - per brush piccoli: meno linee, più vicine e più soft
    // =====================================================
    const isTinyBrush = brushSize <= 32;

    const repeatCount = isTinyBrush ? 3 : 5;
    const deltaStep   = isTinyBrush ? 3 : 4;
    const startDelta  = isTinyBrush ? 5 : 8;

    for (let i = 0; i < repeatCount; i++) {
      const delta = startDelta + deltaStep * i;

      // alpha che cala verso l’esterno; un po’ più bassa sui pennelli piccoli
      let lineAlpha =
        (isTinyBrush ? 0.35 : 0.45) - i * (isTinyBrush ? 0.05 : 0.06);
      if (lineAlpha < 0.10) lineAlpha = 0.10;

      debug.lineStyle({
        width: 1,
        color: 0x463120,   // marrone più chiaro del bordo
        alpha: lineAlpha,
        ...baseStyle,
      });

      // poligono offset + smussato (già gestito in drawOffsetFillAreas)
      drawOffsetFillAreas(delta);
    }

    // =====================================================
    // 3) BORDO MARRONE PRINCIPALE (invariato)
    // =====================================================
    debug.lineStyle({
      width: 5,
      color: 0x2b1608,
      alpha: 1,
      ...baseStyle,
    });
    drawAllFillAreas();

    // =====================================================
    // 4) PREVIEW DELLA PENNELLATA (invariato)
    // =====================================================
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


  // helper per creare un brush per una certa area
  function createBrushForArea(area: TerrainArea): BrushEngine {
    return new BrushEngine({
      area,
      scale: brushScale,
      rotRange: [0, Math.PI * 2] as [number, number],
      accumulatePerStroke: true,
      useCapsule: false,
      // 🔹 ora usa anche la roughness corrente
      spacing: spacingFromSize(brushSize, currentRoughness),
      spacingJitter: 0.22,
      onChange: () => {
        const layer = activeLayer();
        const preview = layer.brush.getPreview();

        if (!preview || preview.length === 0) {
          // nascondi l’anteprima del fill
          layer.previewBg.container.visible = false;
          scheduleDrawDebug(null);
          return;
        }

        // 🔹 mostra il fill di anteprima
        layer.previewMesh.update(preview);
        layer.previewBg.container.visible = true;

        // manteniamo anche l’anteprima del bordo nel debug
        scheduleDrawDebug(preview);
      },
      onDebug: (info: any) => {
        debugInfo = info;
      },
    });
  }

  // layer di fill attivo
  let currentFillType: FillType = "grass";
  const activeLayer = (): FillLayer => fillLayers[currentFillType];

  // --- UI: selettore layer di sfondo (base) ---
  new LayerSelector((type) => {
    mountBaseBackground(type);
  });

  // --- UI: BrushSelector (select in alto a destra) ---
  new BrushSelector((size) => {
    brushSize = size;
    brushScale = brushSize / 64;
    for (const t of FILL_TYPES) {
      const b = fillLayers[t].brush;
      b.setScale(brushScale);
      b.setSpacing(spacingFromSize(brushSize, currentRoughness));
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

  // --- SLIDER BRUSH SIZE ---
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
    for (const t of FILL_TYPES) {
      const b = fillLayers[t].brush;
      b.setScale(brushScale);
      b.setSpacing(spacingFromSize(brushSize, currentRoughness));
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

    // quando cambia la roughness, ri–tariamo anche la spaziatura del brush
    for (const t of FILL_TYPES) {
      const b = fillLayers[t].brush;
      b.setSpacing(spacingFromSize(brushSize, currentRoughness));
    }

    const preview = activeLayer().brush.getPreview();
    if (preview) scheduleDrawDebug(preview);
  });


  // --- POINTER ---
  function worldFromEvent(e: PointerEvent): Vec2 {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - editor.world.x) / editor.world.scale.x;
    const y = (e.clientY - rect.top - editor.world.y) / editor.world.scale.y;
    return [x, y];
  }

    function strokeMove(pos: Vec2) {
    const layer = activeLayer();

    if (!lastPaintPos) {
      lastPaintPos = pos;
      layer.brush.pointerMove(pos);
      return;
    }

    const [lx, ly] = lastPaintPos;
    const dx = pos[0] - lx;
    const dy = pos[1] - ly;
    const dist = Math.hypot(dx, dy);

    // distanza massima tra due campioni del mouse prima di “spezzare” il segmento
    const maxStep = Math.max(4, brushSize * 0.35);

    if (dist <= maxStep) {
      layer.brush.pointerMove(pos);
      lastPaintPos = pos;
      return;
    }

    const steps = Math.ceil(dist / maxStep);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = lx + dx * t;
      const y = ly + dy * t;
      layer.brush.pointerMove([x, y]);
    }
    lastPaintPos = pos;
  }


  canvas.addEventListener("pointerdown", (e) => {
    if (controls.isPanActive) return;
    const p = worldFromEvent(e);
    lastPaintPos = p;
    activeLayer().brush.pointerDown(p);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (controls.isPanActive) return;
    const p = worldFromEvent(e);
    strokeMove(p);
  });

  window.addEventListener("pointerup", () => {
    if (controls.isPanActive) return;
    const layer = activeLayer();

    layer.brush.pointerUp();
    layer.mesh.update(layer.area.geometry); // commit del fill definitivo

    // 🔹 nascondi l’anteprima del fill
    layer.previewBg.container.visible = false;

    scheduleDrawDebug(null);
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
  for (const t of FILL_TYPES) {
    fillLayers[t].mesh.update(fillLayers[t].area.geometry);
  }
  drawDebug();
}
