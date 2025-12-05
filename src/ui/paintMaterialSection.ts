// src/ui/paintMaterialSection.ts
import type { EditorState } from '../core/state';
import { createGroup, setStyles } from './sidebarHelpers';

/**
 * Lista materiali usata dal Paint Tool.
 * Copiata 1:1 da sidebar.ts
 */
const materials = [
  {
    id: 'reddungeon',
    label: 'Red Dungeon',
    preview: '/tiles/reddungeon/reddungeon_1.png',
  },
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

type MaterialButtonsMap = Record<string, HTMLButtonElement[]>;

export interface PaintMaterialSectionHandles {
  group: HTMLElement; // gruppo "Texture" pronto da appendere nel Paint
  updateMaterialButtonsHighlight: () => void;
}

/**
 * Crea:
 * - gruppo "Texture" con card grande + overlay "Show catalog"
 * - modal overlay con griglia di tile materiali
 *
 * onMaterialChanged viene chiamato ogni volta che cambia materiale
 * (nel nostro caso: chiamiamo drawPreview() da sidebar.ts).
 */
export function createPaintMaterialSection(
  editorState: EditorState,
  onMaterialChanged: () => void,
): PaintMaterialSectionHandles {
  let selectedMaterialId: MaterialIdLiteral = editorState.activeMaterial as any;
  const materialButtons: MaterialButtonsMap = {};

  let openMaterialModal: (() => void) | null = null;
  let updateCurrentMaterialPreview: () => void = () => {};

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
    updateCurrentMaterialPreview(); // aggiorna il box grande della texture corrente
    onMaterialChanged();            // equivalente al vecchio drawPreview()
  }

  // -------------------------------------------------
  // MODALE CATALOGO MATERIALI (copiato da sidebar.ts)
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

    registerMaterialButton(mat.id, itemBtn);

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
  // GRUPPO TEXTURE (card con overlay "Show catalog")
  // -------------------------------------------------
  const paintMatGroup = createGroup('Texture');

  const paintMatCard = document.createElement('button');
  paintMatCard.type = 'button';
  paintMatCard.className = 'tf-material-current';

  const paintMatThumb = document.createElement('div');
  paintMatThumb.className = 'tf-material-current-thumb';

  const paintMatOverlay = document.createElement('div');
  paintMatOverlay.className = 'tf-material-current-overlay';
  paintMatOverlay.textContent = 'Show catalog';

  paintMatThumb.appendChild(paintMatOverlay);
  paintMatCard.appendChild(paintMatThumb);
  paintMatGroup.appendChild(paintMatCard);

  // click sulla card → apre il modal dei materiali
  paintMatCard.onclick = () => {
    if (openMaterialModal) openMaterialModal();
  };

  // aggiorna solo lo sfondo del thumb con la texture corrente
  updateCurrentMaterialPreview = () => {
    const mat =
      materials.find((m) => m.id === selectedMaterialId) ?? materials[0];

    paintMatThumb.style.backgroundImage = `url(${mat.preview})`;
  };

  // sync iniziale
  updateCurrentMaterialPreview();

  return {
    group: paintMatGroup,
    updateMaterialButtonsHighlight,
  };
}
