// src/ui/sidebarPanels/shovelPanel.ts

import type { EditorState } from "../../core/state";

// Questa interfaccia descrive le funzioni della sidebar che il pannello riusa.
// Le abbiamo progettate così da NON cambiare nulla nel file originale.
export interface ShovelPanelDeps {
  createAccordionSection: (
    title: string,
    toolId: string | null,
  ) => {
    header: HTMLButtonElement;
    body: HTMLDivElement;
    container: HTMLDivElement;
  };

  createGroup: (title: string) => HTMLElement;

  createShapeButton: (
    shape: any,
    label: string,
    iconClass: string,
  ) => HTMLButtonElement;

  openSection: (
    header: HTMLButtonElement,
    bodyInner: HTMLDivElement,
  ) => void;

  drawPreview: () => void;

  // preview PIXI (già creati nella sidebar)
  previewGroup: HTMLElement;
  previewCanvasShovel: HTMLCanvasElement | null;
  borderMaskToggleShovel: HTMLInputElement | null;
}

export function createShovelPanel(
  editorState: EditorState,
  contentWrapper: HTMLElement,
  deps: ShovelPanelDeps,
) {
  const {
    createAccordionSection,
    createGroup,
    createShapeButton,
    openSection,
    drawPreview,
    previewGroup,
  } = deps;

  // -------------------------------------------------
  // Sezione principale
  // -------------------------------------------------
  const shovelSection = createAccordionSection("Shovel Tool", "shovel");
  const shovelBodyInner = shovelSection.body;

  // -------------------------------------------------
  // BRUSH SIZE
  // -------------------------------------------------
  const shovelSizeGroup = createGroup("Brush Size");
  const shovelSizeRow = document.createElement("div");
  shovelSizeRow.className = "tf-slider-row";

  const shovelSizeRange = document.createElement("input");
  shovelSizeRange.type = "range";
  shovelSizeRange.min = "20";
  shovelSizeRange.max = "2000";
  shovelSizeRange.value = editorState.brush.size.toString();

  const shovelSizeValue = document.createElement("input");
  shovelSizeValue.type = "number";
  shovelSizeValue.min = "20";
  shovelSizeValue.max = "2000";
  shovelSizeValue.value = editorState.brush.size.toString();
  shovelSizeValue.className = "tf-number-input";

  const applyShovelSize = (val: number) => {
    const min = Number(shovelSizeRange.min);
    const max = Number(shovelSizeRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    shovelSizeRange.value = String(clamped);
    shovelSizeValue.value = String(clamped);
    editorState.brush.size = clamped;
    drawPreview();
  };

  shovelSizeRange.oninput = () => applyShovelSize(Number(shovelSizeRange.value));
  shovelSizeValue.oninput = () => applyShovelSize(Number(shovelSizeValue.value));

  shovelSizeRow.appendChild(shovelSizeRange);
  shovelSizeRow.appendChild(shovelSizeValue);
  shovelSizeGroup.appendChild(shovelSizeRow);
  shovelBodyInner.appendChild(shovelSizeGroup);

  // -------------------------------------------------
  // ROUGHNESS
  // -------------------------------------------------
  const shovelRoughGroup = createGroup("Roughness");
  const shovelRoughRow = document.createElement("div");
  shovelRoughRow.className = "tf-slider-row";

  const shovelRoughRange = document.createElement("input");
  shovelRoughRange.type = "range";
  shovelRoughRange.min = "0";
  shovelRoughRange.max = "50";
  shovelRoughRange.value = editorState.brush.roughness.toString();

  const shovelRoughValue = document.createElement("input");
  shovelRoughValue.type = "number";
  shovelRoughValue.min = "0";
  shovelRoughValue.max = "50";
  shovelRoughValue.value = editorState.brush.roughness.toString();
  shovelRoughValue.className = "tf-number-input";

  const applyShovelRough = (val: number) => {
    const min = Number(shovelRoughRange.min);
    const max = Number(shovelRoughRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    shovelRoughRange.value = String(clamped);
    shovelRoughValue.value = String(clamped);
    editorState.brush.roughness = clamped;
    drawPreview();
  };

  shovelRoughRange.oninput = () =>
    applyShovelRough(Number(shovelRoughRange.value));

  shovelRoughValue.oninput = () =>
    applyShovelRough(Number(shovelRoughValue.value));

  shovelRoughRow.appendChild(shovelRoughRange);
  shovelRoughRow.appendChild(shovelRoughValue);
  shovelRoughGroup.appendChild(shovelRoughRow);
  shovelBodyInner.appendChild(shovelRoughGroup);

  // -------------------------------------------------
  // BRUSH SHAPE
  // -------------------------------------------------
  const shovelShapeGroup = createGroup("Brush Shape");
  const shovelShapeRow = document.createElement("div");
  shovelShapeRow.className = "tf-button-group";

  shovelShapeRow.appendChild(
    createShapeButton("polygon", "Polygon", "tf-icon-polygon"),
  );
  shovelShapeRow.appendChild(
    createShapeButton("circle", "Circle", "tf-icon-circle"),
  );
  shovelShapeRow.appendChild(
    createShapeButton("square", "Square", "tf-icon-square"),
  );

  shovelShapeGroup.appendChild(shovelShapeRow);
  shovelBodyInner.appendChild(shovelShapeGroup);

  // -------------------------------------------------
  // BRUSH PREVIEW (già costruito fuori, qui solo append)
  // -------------------------------------------------
  shovelBodyInner.appendChild(previewGroup);

  // append della sezione
  contentWrapper.appendChild(shovelSection.container);

  // click header = selezione tool + toggle accordion
  shovelSection.header.onclick = () => {
    editorState.activeTool = "shovel" as any;
    openSection(shovelSection.header, shovelBodyInner);
  };

  return {
    header: shovelSection.header,
    bodyInner: shovelBodyInner,
    roughnessGroup: shovelRoughGroup, // serve al paint per share visibility
  };
}
