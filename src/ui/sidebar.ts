// src/ui/sidebar.ts
import type { EditorState } from "../core/state";
import type { EditorRenderer } from "../rendering/renderer";
import type { ShovelTool } from "../core/tools/shovelTool";
import { createCursorPanel } from "./sidebarPanels/cursorPanel";
import { createShovelPanel } from "./sidebarPanels/shovelPanel";
import { createPaintPanel } from "./sidebarPanels/paintPanel";

import * as PIXI from "pixi.js";
import "../styles/sidebar.css";

import {
  setStyles,
  createGroup,
  createAccordionSection,
} from "./sidebarHelpers";
import { createPreviewCanvas, renderPolygonToCanvas } from "./brushPreview";

export function createSidebar(
  root: HTMLElement,
  editorState: EditorState,
  renderer: EditorRenderer | null,
) {
  let currentRenderer: EditorRenderer | null = renderer;
  let shovelTool: ShovelTool | null = null;

  function setRenderer(r: EditorRenderer, shovel: ShovelTool) {
    currentRenderer = r;
    shovelTool = shovel;
    drawPreview();
  }

  function openSection(header: HTMLButtonElement, _bodyInner: HTMLDivElement) {
    sidebar
      .querySelectorAll<HTMLButtonElement>(".tf-accordion-header.is-active")
      .forEach((h) => h.classList.remove("is-active"));

    sidebar
      .querySelectorAll<HTMLDivElement>(".tf-accordion-body.is-open")
      .forEach((b) => b.classList.remove("is-open"));

    header.classList.add("is-active");
    const body = header.nextElementSibling as HTMLDivElement | null;
    if (body && body.classList.contains("tf-accordion-body")) {
      body.classList.add("is-open");
    }
  }

  // -------------------------------------------------
  // BRUSH SHAPE (polygon / circle / square) – condiviso
  // -------------------------------------------------
  type BrushShapeLiteral = "polygon" | "circle" | "square";

  let currentBrushShape = (((editorState.brush as any).shape ??
    "polygon") as BrushShapeLiteral);

  const shapeButtons: HTMLButtonElement[] = [];

  let shovelRoughGroupEl: HTMLElement | null = null;
  let paintRoughGroupEl: HTMLElement | null = null;

  let previewGroup: HTMLElement | null = null;
  let previewGroupPaint: HTMLElement | null = null;

  let updateMaterialButtonsHighlightFromPaint: () => void = () => {};

  // riferimento ai canvas / container dei due preview
  let previewCanvasShovel: HTMLCanvasElement | null = null;
  let previewContainerShovel: PIXI.Container | null = null;
  let borderMaskToggleShovel: HTMLInputElement | null = null;

  let previewCanvasPaint: HTMLCanvasElement | null = null;
  let previewContainerPaint: PIXI.Container | null = null;
  let borderMaskTogglePaint: HTMLInputElement | null = null;

  function applyBrushShape(shape: BrushShapeLiteral) {
    currentBrushShape = shape;
    (editorState.brush as any).shape = shape;

    shapeButtons.forEach((btn) => {
      const btnShape = btn.dataset.shapeId as BrushShapeLiteral | undefined;
      if (!btnShape) return;
      if (btnShape === shape) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });

    const display = shape === "polygon" ? "" : "none";
    if (shovelRoughGroupEl) shovelRoughGroupEl.style.display = display;
    if (paintRoughGroupEl) paintRoughGroupEl.style.display = display;
    if (previewGroup) previewGroup.style.display = display;
    if (previewGroupPaint) previewGroupPaint.style.display = display;

    drawPreview();
  }

  function createShapeButton(
    shape: BrushShapeLiteral,
    label: string,
    iconClass: string,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tf-btn-toggle";
    btn.dataset.shapeId = shape;

    const icon = document.createElement("span");
    icon.className = `tf-icon-shape ${iconClass}`;
    btn.appendChild(icon);

    const text = document.createElement("span");
    text.textContent = label;
    btn.appendChild(text);

    btn.onclick = () => applyBrushShape(shape);

    shapeButtons.push(btn);
    return btn;
  }

  // -------------------------------------------------
  // Sidebar root
  // -------------------------------------------------
  const sidebar = document.createElement("div");
  sidebar.className = "tf-sidebar";
  setStyles(sidebar, {
    position: "fixed",
    top: "0",
    left: "0",
    height: "100%",
    zIndex: "9999",
  });

  const headerTop = document.createElement("div");
  headerTop.className = "tf-sidebar-header";

  const headerTitle = document.createElement("div");
  headerTitle.className = "tf-sidebar-title";
  headerTitle.textContent = "TERRAIN TOOLS";

  headerTop.appendChild(headerTitle);
  sidebar.appendChild(headerTop);

  const contentWrapper = document.createElement("div");
  setStyles(contentWrapper, {
    flex: "1",
    overflowY: "auto",
  });
  sidebar.appendChild(contentWrapper);

  root.appendChild(sidebar);

  // ============================================================
  // 🎨 BRUSH PREVIEW – SOLO POLIGONO (logica condivisa)
  // ============================================================
  const dpr = window.devicePixelRatio || 1;

  previewGroup = createGroup("Brush Preview");

  {
    const { canvas, container } = createPreviewCanvas(dpr);

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = true;

    const label = document.createElement("label");
    label.textContent = "Show Border Mask";
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.appendChild(toggle);

    previewGroup.appendChild(label);
    previewGroup.appendChild(canvas);

    previewCanvasShovel = canvas;
    previewContainerShovel = container;
    borderMaskToggleShovel = toggle;

    toggle.onchange = () => drawPreview();
  }

  function drawPreview() {
    const shapeType = (editorState.brush as any).shape ?? "circle";
    if (shapeType !== "polygon" || !shovelTool) return;

    const poly = shovelTool.createTestStampPreview(editorState);
    if (!poly || !poly.length) return;

    if (
      previewCanvasShovel &&
      previewContainerShovel &&
      borderMaskToggleShovel
    ) {
      renderPolygonToCanvas(
        poly,
        previewCanvasShovel,
        previewContainerShovel,
        borderMaskToggleShovel.checked,
      );
    }

    if (
      previewCanvasPaint &&
      previewContainerPaint &&
      borderMaskTogglePaint
    ) {
      renderPolygonToCanvas(
        poly,
        previewCanvasPaint,
        previewContainerPaint,
        borderMaskTogglePaint.checked,
      );
    }
  }

  // -------------------------------------------------
  // SECTION 1 – CURSOR TOOL
  // -------------------------------------------------
  const cursorPanel = createCursorPanel(
    editorState,
    contentWrapper,
    createAccordionSection,
    openSection,
  );
  const cursorSectionHeader = cursorPanel.header;
  const cursorBodyInner = cursorPanel.bodyInner;

  // -------------------------------------------------
  // SECTION 2 – SHOVEL TOOL
  // -------------------------------------------------
  const shovelPanel = createShovelPanel(editorState, contentWrapper, {
    createAccordionSection,
    createGroup,
    createShapeButton,
    openSection,
    drawPreview,
    previewGroup,
    previewCanvasShovel,
    borderMaskToggleShovel,
  });

  const shovelSectionHeader = shovelPanel.header;
  const shovelBodyInner = shovelPanel.bodyInner;
  shovelRoughGroupEl = shovelPanel.roughnessGroup;

  // -------------------------------------------------
  // SECTION 3 – PAINT TOOL
  // -------------------------------------------------
  const paintPanel = createPaintPanel(editorState, contentWrapper, {
    createAccordionSection,
    createGroup,
    createShapeButton,
    openSection,
    drawPreview,
    onFillLayer: () => {
      if (!currentRenderer) {
        console.warn("FillLayer: renderer non ancora inizializzato");
        return;
      }
      currentRenderer.fillPaintLayer();
    },
    onFillShapePreview: (mode, ringWidth) => {
      if (!currentRenderer) return;
      currentRenderer.updatePaintSelectionPreview(mode, ringWidth);
    },
    onApplyShape: (mode, ringWidth) => {
      if (!currentRenderer) {
        console.warn("ApplyShape: renderer non ancora inizializzato");
        return;
      }
      currentRenderer.applyPaintSelection(mode, ringWidth);
    },
  });

  const paintSectionHeader = paintPanel.header;
  const paintBodyInner = paintPanel.bodyInner;

  paintRoughGroupEl = paintPanel.roughnessGroup;
  updateMaterialButtonsHighlightFromPaint =
    paintPanel.updateMaterialButtonsHighlight;

  // -------------------------------------------------
  // Stato iniziale
  // -------------------------------------------------
  const activeTool = editorState.activeTool as any;

  if (activeTool === "paint") {
    openSection(paintSectionHeader, paintBodyInner);
  } else if (activeTool === "cursor") {
    openSection(cursorSectionHeader, cursorBodyInner);
  } else {
    editorState.activeTool = "shovel" as any;
    openSection(shovelSectionHeader, shovelBodyInner);
  }

  updateMaterialButtonsHighlightFromPaint();
  applyBrushShape(currentBrushShape);

  return {
    setRenderer,
  };
}
