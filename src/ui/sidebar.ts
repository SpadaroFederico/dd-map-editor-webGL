// src/ui/sidebar.ts
import type { EditorState } from '../core/state';
import type { EditorRenderer } from '../rendering/renderer';
import "../styles/sidebar.css";

/**
 * Crea la sidebar UI e collega tutti i controlli allo stato dell'editor.
 * Restituisce un oggetto con una funzione setRenderer() che possiamo chiamare dopo.
 */
export function createSidebar(
  root: HTMLElement,
  editorState: EditorState,
  renderer: EditorRenderer | null,
) {
  let currentRenderer: EditorRenderer | null = renderer;

  function setRenderer(r: EditorRenderer) {
    currentRenderer = r;
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------
  function setStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    Object.assign(el.style, styles);
  }

  function createGroup(title: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'tf-group';

    const label = document.createElement('div');
    label.className = 'tf-group-label';
    label.textContent = title;

    group.appendChild(label);
    return group;
  }

  function createAccordionSection(
    title: string,
    toolId: string | null,
  ): { header: HTMLButtonElement; body: HTMLDivElement; container: HTMLDivElement } {
    const container = document.createElement('div');
    container.className = 'tf-accordion-item';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'tf-accordion-header';
    if (toolId) header.dataset.toolId = toolId;

    const headerMain = document.createElement('div');
    headerMain.className = 'tf-accordion-header-main';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tf-accordion-title';
    titleSpan.textContent = title;

    headerMain.appendChild(titleSpan);

    const chevron = document.createElement('span');
    chevron.className = 'tf-accordion-chevron';
    chevron.textContent = '▾';

    header.appendChild(headerMain);
    header.appendChild(chevron);

    const body = document.createElement('div');
    body.className = 'tf-accordion-body';

    const bodyInner = document.createElement('div');
    bodyInner.className = 'tf-panel-content';
    body.appendChild(bodyInner);

    container.appendChild(header);
    container.appendChild(body);

    return { header, body: bodyInner, container };
  }

  function openSection(header: HTMLButtonElement, bodyInner: HTMLDivElement) {
    // chiudi tutte
    sidebar
      .querySelectorAll<HTMLButtonElement>('.tf-accordion-header.is-active')
      .forEach((h) => h.classList.remove('is-active'));

    sidebar
      .querySelectorAll<HTMLDivElement>('.tf-accordion-body.is-open')
      .forEach((b) => b.classList.remove('is-open'));

    // apri questa
    header.classList.add('is-active');
    const body = header.nextElementSibling as HTMLDivElement | null;
    if (body && body.classList.contains('tf-accordion-body')) {
      body.classList.add('is-open');
    }
  }

  // -------------------------------------------------
  // MATERIAL PICKER – SOLO PER PAINT
  // -------------------------------------------------
  const materials = [
    {
      id: 'grass',
      label: 'Grass',
      preview: '/tiles/grass/grass_1.png',
    },
    {
      id: 'dirt',
      label: 'Dirt',
      preview: '/tiles/dirt/dirt_stylized_rock_1.png',
    },
    {
      id: 'water',
      label: 'Water',
      preview: '/tiles/water/water_1.png',
    },
  ] as const;

  type MaterialIdLiteral = (typeof materials)[number]['id'];

  let selectedMaterialId: MaterialIdLiteral = editorState.activeMaterial as any;

  const materialButtons: Record<string, HTMLButtonElement[]> = {};
  let openMaterialModal: (() => void) | null = null;

  function registerMaterialButton(id: string, btn: HTMLButtonElement) {
    if (!materialButtons[id]) materialButtons[id] = [];
    materialButtons[id].push(btn);
  }

  function updateMaterialButtonsHighlight() {
    Object.entries(materialButtons).forEach(([id, buttons]) => {
      const active = id === selectedMaterialId;
      buttons.forEach((btn) => {
        if (active) {
          btn.classList.add('is-active');
        } else {
          btn.classList.remove('is-active');
        }
      });
    });
  }

    function applyMaterial(id: MaterialIdLiteral) {
    selectedMaterialId = id;
    editorState.activeMaterial = id as any;

    updateMaterialButtonsHighlight();
    }


  // -------------------------------------------------
  // BRUSH SHAPE (polygon / circle / square) – condiviso
  // -------------------------------------------------
  type BrushShapeLiteral = 'polygon' | 'circle' | 'square';

  let currentBrushShape = (((editorState.brush as any).shape ??
    'polygon') as BrushShapeLiteral);

  const shapeButtons: HTMLButtonElement[] = [];

  let shovelRoughGroupEl: HTMLElement | null = null;
  let paintRoughGroupEl: HTMLElement | null = null;

  function applyBrushShape(shape: BrushShapeLiteral) {
    currentBrushShape = shape;
    (editorState.brush as any).shape = shape;

    // evidenzia i pulsanti attivi
    shapeButtons.forEach((btn) => {
      const btnShape = btn.dataset.shapeId as BrushShapeLiteral | undefined;
      if (!btnShape) return;
      if (btnShape === shape) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // 👇 Roughness visibile SOLO se shape = 'polygon'
    const display = shape === 'polygon' ? '' : 'none';
    if (shovelRoughGroupEl) shovelRoughGroupEl.style.display = display;
    if (paintRoughGroupEl) paintRoughGroupEl.style.display = display;
  }

  function createShapeButton(
    shape: BrushShapeLiteral,
    label: string,
    iconClass: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-btn-toggle';
    btn.dataset.shapeId = shape;

    const icon = document.createElement('span');
    icon.className = `tf-icon-shape ${iconClass}`;
    btn.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = label;
    btn.appendChild(text);

    btn.onclick = () => applyBrushShape(shape);

    shapeButtons.push(btn);
    return btn;
  }

  // -------------------------------------------------
  // Sidebar root
  // -------------------------------------------------
  const sidebar = document.createElement('div');
  sidebar.className = 'tf-sidebar';
  setStyles(sidebar, {
    position: 'fixed',
    top: '0',
    left: '0',
    height: '100%',
    zIndex: '9999',
  });

  const headerTop = document.createElement('div');
  headerTop.className = 'tf-sidebar-header';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'tf-sidebar-title';
  headerTitle.textContent = 'TERRAIN TOOLS';

  headerTop.appendChild(headerTitle);
  sidebar.appendChild(headerTop);

  const contentWrapper = document.createElement('div');
  setStyles(contentWrapper, {
    flex: '1',
    overflowY: 'auto',
  });
  sidebar.appendChild(contentWrapper);

  root.appendChild(sidebar);

  // -------------------------------------------------
  // MODALE CATALOGO MATERIALI
  // -------------------------------------------------
  const modalOverlay = document.createElement('div');
  setStyles(modalOverlay, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
  });

  const modal = document.createElement('div');
  setStyles(modal, {
    backgroundColor: '#18110b',
    border: '1px solid #3b2d1d',
    borderRadius: '8px',
    padding: '16px',
    width: '420px',
    maxHeight: '70%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
  });
  modalOverlay.appendChild(modal);

  const modalHeader = document.createElement('div');
  setStyles(modalHeader, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  });
  modal.appendChild(modalHeader);

  const modalTitle = document.createElement('div');
  modalTitle.textContent = 'Select Terrain Type';
  setStyles(modalTitle, {
    fontWeight: 'bold',
    fontSize: '13px',
  });
  modalHeader.appendChild(modalTitle);

  const modalClose = document.createElement('button');
  modalClose.type = 'button';
  modalClose.textContent = '✕';
  setStyles(modalClose, {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '13px',
  });
  modalHeader.appendChild(modalClose);

  const modalGrid = document.createElement('div');
  modalGrid.className = 'tf-terrain-grid';
  modal.appendChild(modalGrid);

  materials.forEach((mat) => {
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'tf-terrain-tile';

    const thumb = document.createElement('div');
    thumb.className = 'tf-terrain-thumb';
    thumb.style.backgroundImage = `url(${mat.preview})`;

    const label = document.createElement('div');
    label.className = 'tf-terrain-label';
    label.textContent = mat.label;

    itemBtn.appendChild(thumb);
    itemBtn.appendChild(label);

    itemBtn.onclick = () => {
      applyMaterial(mat.id);
      closeMaterialModal();
    };

    modalGrid.appendChild(itemBtn);
  });

  function openMaterialModalImpl() {
    modalOverlay.style.display = 'flex';
  }
  function closeMaterialModal() {
    modalOverlay.style.display = 'none';
  }

  modalClose.onclick = () => closeMaterialModal();
  modalOverlay.addEventListener('click', (ev) => {
    if (ev.target === modalOverlay) closeMaterialModal();
  });

  document.body.appendChild(modalOverlay);
  openMaterialModal = openMaterialModalImpl;

  // -------------------------------------------------
  // SECTION 1 – CURSOR TOOL
  // -------------------------------------------------
  const cursorSection = createAccordionSection('Cursor Tool', 'cursor');
  const cursorBodyInner = cursorSection.body;

  const cursorText = document.createElement('div');
  cursorText.className = 'tf-panel-empty';
  cursorText.textContent =
    'Nessuna impostazione. Usa il cursore per selezionare e navigare.';
  cursorBodyInner.appendChild(cursorText);

  contentWrapper.appendChild(cursorSection.container);

  cursorSection.header.onclick = () => {
    editorState.activeTool = 'cursor' as any;
    openSection(cursorSection.header, cursorBodyInner);
  };

  // -------------------------------------------------
  // SECTION 2 – SHOVEL TOOL (size + roughness + shape)
  // -------------------------------------------------
  const shovelSection = createAccordionSection('Shovel Tool', 'shovel');
  const shovelBodyInner = shovelSection.body;

  // Brush Size
  const shovelSizeGroup = createGroup('Brush Size');
  const shovelSizeRow = document.createElement('div');
  shovelSizeRow.className = 'tf-slider-row';

  const shovelSizeRange = document.createElement('input');
  shovelSizeRange.type = 'range';
  shovelSizeRange.min = '20';
  shovelSizeRange.max = '2000';
  shovelSizeRange.value = editorState.brush.size.toString();

  const shovelSizeValue = document.createElement('input');
  shovelSizeValue.type = 'number';
  shovelSizeValue.min = '20';
  shovelSizeValue.max = '2000';
  shovelSizeValue.value = editorState.brush.size.toString();
  shovelSizeValue.className = 'tf-number-input';

  const applyShovelSize = (val: number) => {
    const min = Number(shovelSizeRange.min);
    const max = Number(shovelSizeRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    shovelSizeRange.value = String(clamped);
    shovelSizeValue.value = String(clamped);
    editorState.brush.size = clamped;
  };

  shovelSizeRange.oninput = () => applyShovelSize(Number(shovelSizeRange.value));
  shovelSizeValue.oninput = () => applyShovelSize(Number(shovelSizeValue.value));

  shovelSizeRow.appendChild(shovelSizeRange);
  shovelSizeRow.appendChild(shovelSizeValue);
  shovelSizeGroup.appendChild(shovelSizeRow);
  shovelBodyInner.appendChild(shovelSizeGroup);

  // Roughness
  const shovelRoughGroup = createGroup('Roughness');
  shovelRoughGroupEl = shovelRoughGroup;
  const shovelRoughRow = document.createElement('div');
  shovelRoughRow.className = 'tf-slider-row';

  const shovelRoughRange = document.createElement('input');
  shovelRoughRange.type = 'range';
  shovelRoughRange.min = '0';
  shovelRoughRange.max = '50';
  shovelRoughRange.value = editorState.brush.roughness.toString();

  const shovelRoughValue = document.createElement('input');
  shovelRoughValue.type = 'number';
  shovelRoughValue.min = '0';
  shovelRoughValue.max = '50';
  shovelRoughValue.value = editorState.brush.roughness.toString();
  shovelRoughValue.className = 'tf-number-input';

  const applyShovelRough = (val: number) => {
    const min = Number(shovelRoughRange.min);
    const max = Number(shovelRoughRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    shovelRoughRange.value = String(clamped);
    shovelRoughValue.value = String(clamped);
    editorState.brush.roughness = clamped;
  };

  shovelRoughRange.oninput = () =>
    applyShovelRough(Number(shovelRoughRange.value));
  shovelRoughValue.oninput = () =>
    applyShovelRough(Number(shovelRoughValue.value));

  shovelRoughRow.appendChild(shovelRoughRange);
  shovelRoughRow.appendChild(shovelRoughValue);
  shovelRoughGroup.appendChild(shovelRoughRow);
  shovelBodyInner.appendChild(shovelRoughGroup);

  // Brush Shape (condivisa)
  const shovelShapeGroup = createGroup('Brush Shape');
  const shovelShapeRow = document.createElement('div');
  shovelShapeRow.className = 'tf-button-group';

  const shovelPolygonBtn = createShapeButton('polygon', 'Polygon', 'tf-icon-polygon');
  const shovelCircleBtn = createShapeButton('circle', 'Circle', 'tf-icon-circle');
  const shovelSquareBtn = createShapeButton('square', 'Square', 'tf-icon-square');

  shovelShapeRow.appendChild(shovelPolygonBtn);
  shovelShapeRow.appendChild(shovelCircleBtn);
  shovelShapeRow.appendChild(shovelSquareBtn);
  shovelShapeGroup.appendChild(shovelShapeRow);
  shovelBodyInner.appendChild(shovelShapeGroup);

  contentWrapper.appendChild(shovelSection.container);

  shovelSection.header.onclick = () => {
    editorState.activeTool = 'shovel' as any;
    openSection(shovelSection.header, shovelBodyInner);
  };

  // -------------------------------------------------
  // SECTION 3 – PAINT TOOL
  // -------------------------------------------------
  const paintSection = createAccordionSection('Paint Tool', 'paint');
  const paintBodyInner = paintSection.body;

  // Brush Size
  const paintSizeGroup = createGroup('Brush Size');
  const paintSizeRow = document.createElement('div');
  paintSizeRow.className = 'tf-slider-row';

  const paintSizeRange = document.createElement('input');
  paintSizeRange.type = 'range';
  paintSizeRange.min = '20';
  paintSizeRange.max = '2000';
  paintSizeRange.value = editorState.brush.size.toString();

  const paintSizeValue = document.createElement('input');
  paintSizeValue.type = 'number';
  paintSizeValue.min = '20';
  paintSizeValue.max = '2000';
  paintSizeValue.value = editorState.brush.size.toString();
  paintSizeValue.className = 'tf-number-input';

  const applyPaintSize = (val: number) => {
    const min = Number(paintSizeRange.min);
    const max = Number(paintSizeRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    paintSizeRange.value = String(clamped);
    paintSizeValue.value = String(clamped);
    editorState.brush.size = clamped;
  };

  paintSizeRange.oninput = () => applyPaintSize(Number(paintSizeRange.value));
  paintSizeValue.oninput = () => applyPaintSize(Number(paintSizeValue.value));

  paintSizeRow.appendChild(paintSizeRange);
  paintSizeRow.appendChild(paintSizeValue);
  paintSizeGroup.appendChild(paintSizeRow);
  paintBodyInner.appendChild(paintSizeGroup);

  // Roughness
  const paintRoughGroup = createGroup('Roughness');
  paintRoughGroupEl = paintRoughGroup;
  const paintRoughRow = document.createElement('div');
  paintRoughRow.className = 'tf-slider-row';

  const paintRoughRange = document.createElement('input');
  paintRoughRange.type = 'range';
  paintRoughRange.min = '0';
  paintRoughRange.max = '50';
  paintRoughRange.value = editorState.brush.roughness.toString();

  const paintRoughValue = document.createElement('input');
  paintRoughValue.type = 'number';
  paintRoughValue.min = '0';
  paintRoughValue.max = '50';
  paintRoughValue.value = editorState.brush.roughness.toString();
  paintRoughValue.className = 'tf-number-input';

  const applyPaintRough = (val: number) => {
    const min = Number(paintRoughRange.min);
    const max = Number(paintRoughRange.max);
    const clamped = Math.max(min, Math.min(max, val));
    paintRoughRange.value = String(clamped);
    paintRoughValue.value = String(clamped);
    editorState.brush.roughness = clamped;
  };

  paintRoughRange.oninput = () =>
    applyPaintRough(Number(paintRoughRange.value));
  paintRoughValue.oninput = () =>
    applyPaintRough(Number(paintRoughValue.value));

  paintRoughRow.appendChild(paintRoughRange);
  paintRoughRow.appendChild(paintRoughValue);
  paintRoughGroup.appendChild(paintRoughRow);
  paintBodyInner.appendChild(paintRoughGroup);

  // Paint Mode
  const modeGroup = createGroup('Paint Mode');
  const modeSelect = document.createElement('select');
  modeSelect.innerHTML = `
    <option value="background">Background</option>
    <option value="foreground">Foreground</option>
    <option value="top">Top</option>
  `;
  modeSelect.value = editorState.activePaintMode as any;
  modeSelect.className = 'tf-number-input';

  modeSelect.onchange = () => {
    editorState.activePaintMode = modeSelect.value as any;
  };

  modeGroup.appendChild(modeSelect);
  paintBodyInner.appendChild(modeGroup);

  // Brush Shape (stesso picker, stessa shape condivisa)
  const paintShapeGroup = createGroup('Brush Shape');
  const paintShapeRow = document.createElement('div');
  paintShapeRow.className = 'tf-button-group';

  const paintPolygonBtn = createShapeButton('polygon', 'Polygon', 'tf-icon-polygon');
  const paintCircleBtn = createShapeButton('circle', 'Circle', 'tf-icon-circle');
  const paintSquareBtn = createShapeButton('square', 'Square', 'tf-icon-square');

  paintShapeRow.appendChild(paintPolygonBtn);
  paintShapeRow.appendChild(paintCircleBtn);
  paintShapeRow.appendChild(paintSquareBtn);
  paintShapeGroup.appendChild(paintShapeRow);
  paintBodyInner.appendChild(paintShapeGroup);

  // Material picker (solo Paint)
  const paintMatGroup = createGroup('Terrain Type');
  const paintMatRow = document.createElement('div');
  paintMatRow.className = 'tf-slider-row';

  const paintTilesGrid = document.createElement('div');
  paintTilesGrid.className = 'tf-terrain-grid';

  const quickMaterialsPaint = materials.slice(0, 4);
  quickMaterialsPaint.forEach((mat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-terrain-tile';
    btn.title = mat.label;

    const thumb = document.createElement('div');
    thumb.className = 'tf-terrain-thumb';
    thumb.style.backgroundImage = `url(${mat.preview})`;

    const label = document.createElement('div');
    label.className = 'tf-terrain-label';
    label.textContent = mat.label;

    btn.appendChild(thumb);
    btn.appendChild(label);

    btn.onclick = () => applyMaterial(mat.id as MaterialIdLiteral);

    paintTilesGrid.appendChild(btn);
    registerMaterialButton(mat.id, btn);
  });

  const paintMoreBtn = document.createElement('button');
  paintMoreBtn.type = 'button';
  paintMoreBtn.textContent = '⋯';
  paintMoreBtn.className = 'tf-btn-toggle';
  paintMoreBtn.style.width = '40px';
  paintMoreBtn.style.height = '40px';
  paintMoreBtn.style.borderRadius = '999px';
  paintMoreBtn.onclick = () => {
    if (openMaterialModal) openMaterialModal();
  };

  paintMatRow.appendChild(paintTilesGrid);
  paintMatRow.appendChild(paintMoreBtn);
  paintMatGroup.appendChild(paintMatRow);
  paintBodyInner.appendChild(paintMatGroup);

  contentWrapper.appendChild(paintSection.container);

  paintSection.header.onclick = () => {
    editorState.activeTool = 'paint' as any;
    openSection(paintSection.header, paintBodyInner);
  };

  // -------------------------------------------------
  // Stato iniziale
  // -------------------------------------------------
  const activeTool = editorState.activeTool as any;

  if (activeTool === 'paint') {
    openSection(paintSection.header, paintBodyInner);
  } else if (activeTool === 'cursor') {
    openSection(cursorSection.header, cursorBodyInner);
  } else {
    editorState.activeTool = 'shovel' as any;
    openSection(shovelSection.header, shovelBodyInner);
  }

  updateMaterialButtonsHighlight();
  applyBrushShape(currentBrushShape);

  return {
    setRenderer,
  };
}
