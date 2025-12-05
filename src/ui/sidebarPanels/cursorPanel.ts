// src/ui/sidebarPanels/cursorPanel.ts

import type { EditorState } from "../../core/state";

export interface AccordionSection {
  header: HTMLButtonElement;
  body: HTMLDivElement;
  container: HTMLDivElement;
}

export type CreateAccordionSectionFn = (
  title: string,
  toolId: string | null,
) => AccordionSection;

export type OpenSectionFn = (
  header: HTMLButtonElement,
  bodyInner: HTMLDivElement,
) => void;

/**
 * Crea la sezione "Cursor Tool" e la collega all'EditorState.
 *
 * Non cambia nessuna logica:
 * - stesso testo
 * - stesso comportamento sul click (activeTool = 'cursor' + openSection)
 * - stesso append su contentWrapper
 */
export function createCursorPanel(
  editorState: EditorState,
  contentWrapper: HTMLElement,
  createAccordionSection: CreateAccordionSectionFn,
  openSection: OpenSectionFn,
) {
  const cursorSection = createAccordionSection("Cursor Tool", "cursor");
  const cursorBodyInner = cursorSection.body;

  const cursorText = document.createElement("div");
  cursorText.className = "tf-panel-empty";
  cursorText.textContent =
    "Nessuna impostazione. Usa il cursore per selezionare e navigare.";
  cursorBodyInner.appendChild(cursorText);

  contentWrapper.appendChild(cursorSection.container);

  cursorSection.header.onclick = () => {
    editorState.activeTool = "cursor" as any;
    openSection(cursorSection.header, cursorBodyInner);
  };

  return {
    header: cursorSection.header,
    bodyInner: cursorBodyInner,
    container: cursorSection.container,
  };
}
