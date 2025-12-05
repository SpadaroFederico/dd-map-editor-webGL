// src/ui/sidebarPanels/paintPanel.ts
import type { EditorState } from "../../core/state";
import { createPaintMaterialSection } from "../paintMaterialSection";

type AccordionSectionFactory = (
  title: string,
  toolId: string,
) => {
  header: HTMLButtonElement;
  body: HTMLDivElement;
  container: HTMLDivElement;
};

interface PaintPanelDeps {
  createAccordionSection: AccordionSectionFactory;
  createGroup: (title: string) => HTMLElement;
  createShapeButton: (
    shape: "polygon" | "circle" | "square",
    label: string,
    iconClass: string,
  ) => HTMLButtonElement;
  openSection: (header: HTMLButtonElement, bodyInner: HTMLDivElement) => void;
  drawPreview: () => void;

  onFillLayer: () => void;
  onFillShapePreview: (mode: "inside" | "outline", ringWidth: number) => void;
  onApplyShape: (mode: "inside" | "outline", ringWidth: number) => void;
}

export interface PaintPanelHandles {
  header: HTMLButtonElement;
  bodyInner: HTMLDivElement;
  roughnessGroup: HTMLElement;
  updateMaterialButtonsHighlight: () => void;
}

export function createPaintPanel(
  editorState: EditorState,
  contentWrapper: HTMLElement,
  deps: PaintPanelDeps,
): PaintPanelHandles {
  const {
    createAccordionSection,
    createGroup,
    createShapeButton,
    openSection,
    drawPreview,
    onFillLayer,
    onFillShapePreview,
    onApplyShape,
  } = deps;

  // stato condiviso per il fill shape
  let currentFillMode: "inside" | "outline" = "inside";
  let currentRingWidth = 40;

  // -------------------------------------------------
  // SECTION – PAINT TOOL
  // -------------------------------------------------
  const paintSection = createAccordionSection("Paint Tool", "paint");
  const paintBodyInner = paintSection.body;

  // ==========================
  // TEXTURE (in alto, stile Catalog)
  // ==========================
  const paintMaterialHandles = createPaintMaterialSection(editorState, () => {
    drawPreview();
  });

  const paintMatGroup = paintMaterialHandles.group;
  paintBodyInner.appendChild(paintMatGroup);

  // ==========================
  // Brush Size
  // ==========================
  const paintSizeGroup = createGroup("Brush Size");
  const paintSizeRow = document.createElement("div");
  paintSizeRow.className = "tf-slider-row";

  const paintSizeRange = document.createElement("input");
  paintSizeRange.type = "range";
  paintSizeRange.min = "20";
  paintSizeRange.max = "2000";
  paintSizeRange.value = editorState.brush.size.toString();

  const paintSizeValue = document.createElement("input");
  paintSizeValue.type = "number";
  paintSizeValue.min = "20";
  paintSizeValue.max = "2000";
  paintSizeValue.value = editorState.brush.size.toString();
  paintSizeValue.className = "tf-number-input";

  const applyPaintSize = (val: number) => {
    const min = Number(paintSizeRange.min);
    const max = Number(paintSizeRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    paintSizeRange.value = String(clamped);
    paintSizeValue.value = String(clamped);
    editorState.brush.size = clamped;
    drawPreview();
    onFillShapePreview(currentFillMode, currentRingWidth);
  };

  paintSizeRange.oninput = () => applyPaintSize(Number(paintSizeRange.value));
  paintSizeValue.oninput = () => applyPaintSize(Number(paintSizeValue.value));

  paintSizeRow.appendChild(paintSizeRange);
  paintSizeRow.appendChild(paintSizeValue);
  paintSizeGroup.appendChild(paintSizeRow);
  paintBodyInner.appendChild(paintSizeGroup);

  // ==========================
  // Roughness
  // ==========================
  const paintRoughGroup = createGroup("Roughness");
  const paintRoughRow = document.createElement("div");
  paintRoughRow.className = "tf-slider-row";

  const paintRoughRange = document.createElement("input");
  paintRoughRange.type = "range";
  paintRoughRange.min = "0";
  paintRoughRange.max = "50";
  paintRoughRange.value = editorState.brush.roughness.toString();

  const paintRoughValue = document.createElement("input");
  paintRoughValue.type = "number";
  paintRoughValue.min = "0";
  paintRoughValue.max = "50";
  paintRoughValue.value = editorState.brush.roughness.toString();
  paintRoughValue.className = "tf-number-input";

  const applyPaintRough = (val: number) => {
    const min = Number(paintRoughRange.min);
    const max = Number(paintRoughRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    paintRoughRange.value = String(clamped);
    paintRoughValue.value = String(clamped);
    editorState.brush.roughness = clamped;
    drawPreview();
  };

  paintRoughRange.oninput = () =>
    applyPaintRough(Number(paintRoughRange.value));
  paintRoughValue.oninput = () =>
    applyPaintRough(Number(paintRoughValue.value));

  paintRoughRow.appendChild(paintRoughRange);
  paintRoughRow.appendChild(paintRoughValue);
  paintRoughGroup.appendChild(paintRoughRow);
  paintBodyInner.appendChild(paintRoughGroup);

  // ==========================
  // Brush Layer + Fill (layer intero)
  // ==========================
  const modeGroup = createGroup("Brush Layer");
  const modeRow = document.createElement("div");
  modeRow.className = "tf-mode-row";

  const modeSelect = document.createElement("select");
  modeSelect.innerHTML = `
    <option value="background">Background</option>
    <option value="foreground">Foreground</option>
    <option value="top">Top</option>
  `;
  modeSelect.value = editorState.activePaintMode as any;
  modeSelect.className = "tf-number-input";

  modeSelect.onchange = () => {
    editorState.activePaintMode = modeSelect.value as any;
  };

  const fillLayerButton = document.createElement("button");
  fillLayerButton.type = "button";
  fillLayerButton.className = "tf-btn-toggle";
  fillLayerButton.textContent = "Fill Layer";

  fillLayerButton.onclick = () => {
    onFillLayer();
  };

  modeRow.appendChild(modeSelect);
  modeRow.appendChild(fillLayerButton);

  modeGroup.appendChild(modeRow);
  paintBodyInner.appendChild(modeGroup);

  // ==========================
  // Shape Fill (inside / outline + spessore + apply)
  // ==========================
  const shapeFillGroup = createGroup("Shape Fill");

  // Row 1: Inside / Outline
  const shapeFillRow1 = document.createElement("div");
  shapeFillRow1.className = "tf-button-group";

  const insideBtn = document.createElement("button");
  insideBtn.type = "button";
  insideBtn.className = "tf-btn-toggle is-active";
  insideBtn.textContent = "Inside";

  const outlineBtn = document.createElement("button");
  outlineBtn.type = "button";
  outlineBtn.className = "tf-btn-toggle";
  outlineBtn.textContent = "Outline";

  const updateFillModeButtons = () => {
    if (currentFillMode === "inside") {
      insideBtn.classList.add("is-active");
      outlineBtn.classList.remove("is-active");
    } else {
      outlineBtn.classList.add("is-active");
      insideBtn.classList.remove("is-active");
    }
  };

  shapeFillRow1.appendChild(insideBtn);
  shapeFillRow1.appendChild(outlineBtn);
  shapeFillGroup.appendChild(shapeFillRow1);

  // Row 2: slider spessore anello
  const shapeFillRow2 = document.createElement("div");
  shapeFillRow2.className = "tf-slider-row";

  const ringWidthRange = document.createElement("input");
  ringWidthRange.type = "range";
  ringWidthRange.min = "0";
  ringWidthRange.max = "400";
  ringWidthRange.value = String(currentRingWidth);

  const ringWidthValue = document.createElement("input");
  ringWidthValue.type = "number";
  ringWidthValue.min = "0";
  ringWidthValue.max = "400";
  ringWidthValue.value = String(currentRingWidth);
  ringWidthValue.className = "tf-number-input";

  const applyRingWidth = (val: number) => {
    const min = Number(ringWidthRange.min);
    const max = Number(ringWidthRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    ringWidthRange.value = String(clamped);
    ringWidthValue.value = String(clamped);
    currentRingWidth = clamped;
    onFillShapePreview(currentFillMode, currentRingWidth);
  };

  ringWidthRange.oninput = () =>
    applyRingWidth(Number(ringWidthRange.value));
  ringWidthValue.oninput = () =>
    applyRingWidth(Number(ringWidthValue.value));

  shapeFillRow2.appendChild(ringWidthRange);
  shapeFillRow2.appendChild(ringWidthValue);
  shapeFillGroup.appendChild(shapeFillRow2);

  // event handler dei bottoni inside/outline (dopo aver creato lo slider)
  insideBtn.onclick = () => {
    currentFillMode = "inside";
    updateFillModeButtons();
    onFillShapePreview(currentFillMode, currentRingWidth);
  };

  outlineBtn.onclick = () => {
    currentFillMode = "outline";
    updateFillModeButtons();
    onFillShapePreview(currentFillMode, currentRingWidth);
  };

  // Row 3: bottone Apply shape
  const shapeFillRow3 = document.createElement("div");
  shapeFillRow3.className = "tf-mode-row";

  const applyShapeBtn = document.createElement("button");
  applyShapeBtn.type = "button";
  applyShapeBtn.className = "tf-btn-toggle";
  applyShapeBtn.textContent = "Apply Shape";

  applyShapeBtn.onclick = () => {
    onApplyShape(currentFillMode, currentRingWidth);
  };

  shapeFillRow3.appendChild(applyShapeBtn);
  shapeFillGroup.appendChild(shapeFillRow3);

  paintBodyInner.appendChild(shapeFillGroup);

  // ==========================
  // Brush Shape (stesso picker condiviso)
  // ==========================
  const paintShapeGroup = createGroup("Brush Shape");
  const paintShapeRow = document.createElement("div");
  paintShapeRow.className = "tf-button-group";

  const paintPolygonBtn = createShapeButton(
    "polygon",
    "Polygon",
    "tf-icon-polygon",
  );
  const paintCircleBtn = createShapeButton(
    "circle",
    "Circle",
    "tf-icon-circle",
  );
  const paintSquareBtn = createShapeButton(
    "square",
    "Square",
    "tf-icon-square",
  );

  paintShapeRow.appendChild(paintPolygonBtn);
  paintShapeRow.appendChild(paintCircleBtn);
  paintShapeRow.appendChild(paintSquareBtn);
  paintShapeGroup.appendChild(paintShapeRow);
  paintBodyInner.appendChild(paintShapeGroup);

  // appendiamo il container completo alla sidebar
  contentWrapper.appendChild(paintSection.container);

  // click header → identico comportamento di prima
  paintSection.header.onclick = () => {
    editorState.activeTool = "paint" as any;
    openSection(paintSection.header, paintBodyInner);
  };

  // preview iniziale della selezione
  onFillShapePreview(currentFillMode, currentRingWidth);

  return {
    header: paintSection.header,
    bodyInner: paintBodyInner,
    roughnessGroup: paintRoughGroup,
    updateMaterialButtonsHighlight:
      paintMaterialHandles.updateMaterialButtonsHighlight,
  };
}
