// src/ui/sidebarHelpers.ts

/**
 * Applica uno stile inline ad un elemento.
 * (Copiato 1:1 da sidebar.ts)
 */
export function setStyles(
  el: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(el.style, styles);
}

/**
 * Crea un gruppo di controlli con etichetta (BRUSH SIZE, ROUGHNESS, ecc.).
 * (Copiato 1:1 da sidebar.ts)
 */
export function createGroup(title: string): HTMLElement {
  const group = document.createElement('div');
  group.className = 'tf-group';

  const label = document.createElement('div');
  label.className = 'tf-group-label';
  label.textContent = title;

  group.appendChild(label);
  return group;
}

/**
 * Crea una sezione accordion (Cursor Tool, Shovel Tool, Paint Tool).
 * Restituisce header, body inner e container esattamente come prima.
 * (Copiato 1:1 da sidebar.ts)
 */
export function createAccordionSection(
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
