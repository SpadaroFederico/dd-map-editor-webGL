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
  // Sidebar root
  // -------------------------------------------------
  const sidebar = document.createElement('div');
  setStyles(sidebar, {
    position: 'fixed',
    top: '0',
    left: '0', // a sinistra come nello screen
    width: '260px',
    height: '100%',
    background: '#120e0a',
    borderRight: '1px solid #2b2118',
    color: '#f2d28b',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
  });

  // header piccolo “Terrain Tools”
  const headerTop = document.createElement('div');
  headerTop.textContent = 'TERRAIN TOOLS';
  setStyles(headerTop, {
    padding: '12px 16px',
    borderBottom: '1px solid #2b2118',
    background: 'linear-gradient(to right, #18110c, #25180d)',
    fontWeight: '600',
    fontSize: '13px',
    letterSpacing: '0.08em',
  });
  sidebar.appendChild(headerTop);

  const contentWrapper = document.createElement('div');
  setStyles(contentWrapper, {
    flex: '1',
    overflowY: 'auto',
  });
  sidebar.appendChild(contentWrapper);

  root.appendChild(sidebar);

  // -------------------------------------------------
  // Helpers per creare elementi e gruppi
  // -------------------------------------------------
  function setStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    Object.assign(el.style, styles);
  }

  function createGroup(title: string): HTMLElement {
    const group = document.createElement('div');
    setStyles(group, {
      marginBottom: '14px',
    });

    const label = document.createElement('div');
    label.textContent = title;
    setStyles(label, {
      fontSize: '11px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: '#b89b68',
      marginBottom: '6px',
    });
    group.appendChild(label);

    return group;
  }

  function createAccordionSection(
    title: string,
    toolId: string | null,
  ): { header: HTMLButtonElement; body: HTMLDivElement; container: HTMLDivElement } {
    const container = document.createElement('div');

    // header
    const header = document.createElement('button');
    header.type = 'button';
    header.textContent = title;
    header.dataset.toolId = toolId ?? '';
    setStyles(header, {
      width: '100%',
      padding: '10px 12px',
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid #2b2118',
      color: '#f2d28b',
      fontSize: '13px',
      textAlign: 'left',
      cursor: 'pointer',
    });

    header.onmouseenter = () => {
      if (!header.classList.contains('tf-accordion-active')) {
        header.style.background = '#1b130d';
      }
    };
    header.onmouseleave = () => {
      if (!header.classList.contains('tf-accordion-active')) {
        header.style.background = 'transparent';
      }
    };

    // body
    const body = document.createElement('div');
    setStyles(body, {
      maxHeight: '0',
      overflow: 'hidden',
      transition: 'max-height 0.18s ease',
      background: '#18110b',
    });

    container.appendChild(header);
    container.appendChild(body);

    return { header, body, container };
  }

  function openSection(header: HTMLButtonElement, body: HTMLDivElement) {
    // chiudo tutte
    sidebar.querySelectorAll<HTMLButtonElement>('.tf-accordion-active').forEach((h) => {
      h.classList.remove('tf-accordion-active');
      h.style.background = 'transparent';
    });
    sidebar.querySelectorAll<HTMLDivElement>('.tf-accordion-body-open').forEach((b) => {
      b.classList.remove('tf-accordion-body-open');
      b.style.maxHeight = '0';
    });

    // apro questa
    header.classList.add('tf-accordion-active');
    header.style.background = '#2b1b0d';
    body.classList.add('tf-accordion-body-open');
    body.style.maxHeight = '1000px';
  }

    // -------------------------------------------------
  // MATERIAL PICKER – dati e helper condivisi
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

  // ogni materiale può avere più bottoni (shovel + paint)
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
        btn.style.outline = active ? '2px solid #f5c14a' : '1px solid #444';
        btn.style.boxShadow = active
          ? '0 0 8px rgba(245, 193, 74, 0.7)'
          : 'none';
      });
    });
  }

  function applyMaterial(id: MaterialIdLiteral) {
    selectedMaterialId = id;
    editorState.activeMaterial = id as any;

    if (currentRenderer) {
      currentRenderer.buildBackgroundPaintLayer(editorState.activeMaterial);
    }

    updateMaterialButtonsHighlight();
  }

    root.appendChild(sidebar);


      // -------------------------------------------------
  // MODALE CATALOGO MATERIALI (overlay condiviso)
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
  setStyles(modalGrid, {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: '10px',
  });
  modal.appendChild(modalGrid);

  materials.forEach((mat) => {
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    setStyles(itemBtn, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      borderRadius: '6px',
      border: '1px solid #3b2d1d',
      padding: '4px',
      backgroundColor: '#20130a',
      cursor: 'pointer',
    });

    const thumb = document.createElement('div');
    setStyles(thumb, {
      width: '60px',
      height: '60px',
      borderRadius: '4px',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundImage: `url(${mat.preview})`,
    });
    itemBtn.appendChild(thumb);

    const label = document.createElement('div');
    label.textContent = mat.label;
    setStyles(label, {
      fontSize: '11px',
      color: '#e3c78a',
    });
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
  const cursorBodyInner = document.createElement('div');
  setStyles(cursorBodyInner, {
    padding: '10px 14px 12px',
  });

  const cursorText = document.createElement('div');
  cursorText.textContent =
    'Nessuna impostazione. Usa il cursore per selezionare e navigare.';
  setStyles(cursorText, {
    fontSize: '12px',
    color: '#8f7b55',
  });

  cursorBodyInner.appendChild(cursorText);
  cursorSection.body.appendChild(cursorBodyInner);
  contentWrapper.appendChild(cursorSection.container);

  // click header → attiva tool e fisarmonica
  cursorSection.header.onclick = () => {
    editorState.activeTool = 'cursor' as any;
    openSection(cursorSection.header, cursorSection.body);
  };

  // -------------------------------------------------
  // SECTION 2 – SHOVEL TOOL
  // -------------------------------------------------
  const shovelSection = createAccordionSection('Shovel Tool', 'shovel');
  const shovelBodyInner = document.createElement('div');
  setStyles(shovelBodyInner, {
    padding: '10px 14px 12px',
  });

  // Brush Size (usa lo stesso editorState.brush.size)
  const shovelSizeGroup = createGroup('Brush Size');
  const shovelSizeRow = document.createElement('div');
  setStyles(shovelSizeRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const shovelSizeRange = document.createElement('input');
  shovelSizeRange.type = 'range';
  shovelSizeRange.min = '20';
  shovelSizeRange.max = '2000';
  shovelSizeRange.value = editorState.brush.size.toString();
  setStyles(shovelSizeRange, {
    flex: '1',
  });

  const shovelSizeValue = document.createElement('input');
  shovelSizeValue.type = 'number';
  shovelSizeValue.min = '20';
  shovelSizeValue.max = '2000';
  shovelSizeValue.value = editorState.brush.size.toString();
  setStyles(shovelSizeValue, {
    width: '70px',
    padding: '4px 6px',
    background: '#120e0a',
    border: '1px solid #3b2d1d',
    color: '#f2d28b',
    borderRadius: '3px',
    fontSize: '12px',
  });

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
  const shovelRoughRow = document.createElement('div');
  setStyles(shovelRoughRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const shovelRoughRange = document.createElement('input');
  shovelRoughRange.type = 'range';
  shovelRoughRange.min = '0';
  shovelRoughRange.max = '50';
  shovelRoughRange.value = editorState.brush.roughness.toString();
  setStyles(shovelRoughRange, {
    flex: '1',
  });

  const shovelRoughValue = document.createElement('input');
  shovelRoughValue.type = 'number';
  shovelRoughValue.min = '0';
  shovelRoughValue.max = '50';
  shovelRoughValue.value = editorState.brush.roughness.toString();
  setStyles(shovelRoughValue, {
    width: '70px',
    padding: '4px 6px',
    background: '#120e0a',
    border: '1px solid #3b2d1d',
    color: '#f2d28b',
    borderRadius: '3px',
    fontSize: '12px',
  });

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

  // Material (Terrain Type) – tile picker
  const shovelMatGroup = createGroup('Terrain Type');

  const shovelMatRow = document.createElement('div');
  setStyles(shovelMatRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const shovelTilesGrid = document.createElement('div');
  setStyles(shovelTilesGrid, {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    flex: '1',
  });

  const quickMaterials = materials.slice(0, 4);
  quickMaterials.forEach((mat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = mat.label;
    setStyles(btn, {
      width: '40px',
      height: '40px',
      borderRadius: '4px',
      border: '1px solid #444',
      padding: '0',
      cursor: 'pointer',
      backgroundColor: '#222',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundImage: `url(${mat.preview})`,
    });

    btn.onmouseenter = () => {
      btn.style.filter = 'brightness(1.1)';
    };
    btn.onmouseleave = () => {
      btn.style.filter = 'none';
    };

    btn.onclick = () => applyMaterial(mat.id as MaterialIdLiteral);

    shovelTilesGrid.appendChild(btn);
    registerMaterialButton(mat.id, btn);
  });

  const shovelMoreBtn = document.createElement('button');
  shovelMoreBtn.type = 'button';
  shovelMoreBtn.textContent = '⋯';
  setStyles(shovelMoreBtn, {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    border: '1px solid #555',
    backgroundColor: '#22140a',
    color: '#f5c14a',
    cursor: 'pointer',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  });

  shovelMoreBtn.onclick = () => {
    if (openMaterialModal) openMaterialModal();
  };

  shovelMatRow.appendChild(shovelTilesGrid);
  shovelMatRow.appendChild(shovelMoreBtn);
  shovelMatGroup.appendChild(shovelMatRow);
  shovelBodyInner.appendChild(shovelMatGroup);


  shovelSection.body.appendChild(shovelBodyInner);
  contentWrapper.appendChild(shovelSection.container);

  shovelSection.header.onclick = () => {
    editorState.activeTool = 'shovel' as any;
    openSection(shovelSection.header, shovelSection.body);
  };

  // -------------------------------------------------
  // SECTION 3 – PAINT TOOL
  // -------------------------------------------------
  const paintSection = createAccordionSection('Paint Tool', 'paint');
  const paintBodyInner = document.createElement('div');
  setStyles(paintBodyInner, {
    padding: '10px 14px 12px',
  });

  // Brush Size (riusa lo stesso editorState.brush.size)
  const paintSizeGroup = createGroup('Brush Size');
  const paintSizeRow = document.createElement('div');
  setStyles(paintSizeRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const paintSizeRange = document.createElement('input');
  paintSizeRange.type = 'range';
  paintSizeRange.min = '20';
  paintSizeRange.max = '2000';
  paintSizeRange.value = editorState.brush.size.toString();
  setStyles(paintSizeRange, {
    flex: '1',
  });

  const paintSizeValue = document.createElement('input');
  paintSizeValue.type = 'number';
  paintSizeValue.min = '20';
  paintSizeValue.max = '2000';
  paintSizeValue.value = editorState.brush.size.toString();
  setStyles(paintSizeValue, {
    width: '70px',
    padding: '4px 6px',
    background: '#120e0a',
    border: '1px solid #3b2d1d',
    color: '#f2d28b',
    borderRadius: '3px',
    fontSize: '12px',
  });

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

  // Roughness (per eventuale jitter del paint, riusa editorState.brush.roughness)
  const paintRoughGroup = createGroup('Roughness');
  const paintRoughRow = document.createElement('div');
  setStyles(paintRoughRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const paintRoughRange = document.createElement('input');
  paintRoughRange.type = 'range';
  paintRoughRange.min = '0';
  paintRoughRange.max = '50';
  paintRoughRange.value = editorState.brush.roughness.toString();
  setStyles(paintRoughRange, {
    flex: '1',
  });

  const paintRoughValue = document.createElement('input');
  paintRoughValue.type = 'number';
  paintRoughValue.min = '0';
  paintRoughValue.max = '50';
  paintRoughValue.value = editorState.brush.roughness.toString();
  setStyles(paintRoughValue, {
    width: '70px',
    padding: '4px 6px',
    background: '#120e0a',
    border: '1px solid #3b2d1d',
    color: '#f2d28b',
    borderRadius: '3px',
    fontSize: '12px',
  });

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

  // Paint Mode (background / foreground / top)
  const modeGroup = createGroup('Paint Mode');
  const modeSelect = document.createElement('select');
  modeSelect.innerHTML = `
    <option value="background">Background</option>
    <option value="foreground">Foreground</option>
    <option value="top">Top</option>
  `;
  modeSelect.value = editorState.activePaintMode as any;
  setStyles(modeSelect, {
    width: '100%',
    padding: '5px 6px',
    background: '#120e0a',
    border: '1px solid #3b2d1d',
    color: '#f2d28b',
    borderRadius: '3px',
    fontSize: '12px',
  });

  modeSelect.onchange = () => {
    editorState.activePaintMode = modeSelect.value as any;
  };

  modeGroup.appendChild(modeSelect);
  paintBodyInner.appendChild(modeGroup);

    // Material (Terrain Type) per il paint – stesso picker
  const paintMatGroup = createGroup('Terrain Type');

  const paintMatRow = document.createElement('div');
  setStyles(paintMatRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const paintTilesGrid = document.createElement('div');
  setStyles(paintTilesGrid, {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    flex: '1',
  });

  const quickMaterialsPaint = materials.slice(0, 4);
  quickMaterialsPaint.forEach((mat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = mat.label;
    setStyles(btn, {
      width: '40px',
      height: '40px',
      borderRadius: '4px',
      border: '1px solid #444',
      padding: '0',
      cursor: 'pointer',
      backgroundColor: '#222',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundImage: `url(${mat.preview})`,
    });

    btn.onmouseenter = () => {
      btn.style.filter = 'brightness(1.1)';
    };
    btn.onmouseleave = () => {
      btn.style.filter = 'none';
    };

    btn.onclick = () => applyMaterial(mat.id as MaterialIdLiteral);

    paintTilesGrid.appendChild(btn);
    registerMaterialButton(mat.id, btn);
  });

  const paintMoreBtn = document.createElement('button');
  paintMoreBtn.type = 'button';
  paintMoreBtn.textContent = '⋯';
  setStyles(paintMoreBtn, {
    width: '28px',
    height: '28px',
    borderRadius: '999px',
    border: '1px solid #555',
    backgroundColor: '#22140a',
    color: '#f5c14a',
    cursor: 'pointer',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  });

  paintMoreBtn.onclick = () => {
    if (openMaterialModal) openMaterialModal();
  };

  paintMatRow.appendChild(paintTilesGrid);
  paintMatRow.appendChild(paintMoreBtn);
  paintMatGroup.appendChild(paintMatRow);
  paintBodyInner.appendChild(paintMatGroup);


  paintSection.body.appendChild(paintBodyInner);
  contentWrapper.appendChild(paintSection.container);

  paintSection.header.onclick = () => {
    editorState.activeTool = 'paint' as any;
    openSection(paintSection.header, paintSection.body);
  };

  // -------------------------------------------------
  // Stato iniziale: apriamo la sezione in base al tool attivo
  // -------------------------------------------------
  const activeTool = editorState.activeTool as any;

  if (activeTool === 'paint') {
    openSection(paintSection.header, paintSection.body);
  } else if (activeTool === 'cursor') {
    openSection(cursorSection.header, cursorSection.body);
  } else {
    // default: shovel
    editorState.activeTool = 'shovel' as any;
    openSection(shovelSection.header, shovelSection.body);
  }

    // evidenzia il materiale corrente (grass/dirt/water) sui bottoni
    updateMaterialButtonsHighlight();


  // ritorniamo le API per il main.ts
  return {
    setRenderer,
  };
}
