// src/ui/Sidebar.ts

import "../styles/sidebar.css";

export class Sidebar {
  sidebar: HTMLDivElement;
  sections: Record<string, HTMLDivElement> = {};

  constructor() {
    this.sidebar = document.createElement("div");
    this.sidebar.id = "sidebar";

    // Titolo
    const title = document.createElement("div");
    title.className = "sidebar-title";
    title.textContent = "Strumenti";
    this.sidebar.appendChild(title);

    document.body.appendChild(this.sidebar);
  }

  // Crea un pannello collassabile
  createSection(id: string, label: string): HTMLDivElement {
    const container = document.createElement("div");
    container.className = "sidebar-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.textContent = label;

    const content = document.createElement("div");
    content.className = "section-content";

    // toggle apertura/chiusura
    header.addEventListener("click", () => {
      content.classList.toggle("open");
    });

    container.appendChild(header);
    container.appendChild(content);
    this.sidebar.appendChild(container);

    this.sections[id] = content;
    return content;
  }

  // Aggiunge un input slider
  addSlider(
    sectionId: string,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (val: number) => void
  ) {
    const section = this.sections[sectionId];
    if (!section) return;

    const wrapper = document.createElement("div");
    wrapper.className = "sidebar-input";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "range";
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    input.value = value.toString();

    input.addEventListener("input", () => {
      onChange(parseInt(input.value, 10));
    });

    wrapper.appendChild(lbl);
    wrapper.appendChild(input);
    section.appendChild(wrapper);
  }

  // Aggiunge una select
  addSelect(
    sectionId: string,
    label: string,
    options: Array<[string, string]>,
    onChange: (value: string) => void
  ) {
    const section = this.sections[sectionId];
    if (!section) return;

    const wrapper = document.createElement("div");
    wrapper.className = "sidebar-input";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const select = document.createElement("select");
    for (const [val, text] of options) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    }

    select.addEventListener("change", () => onChange(select.value));

    wrapper.appendChild(lbl);
    wrapper.appendChild(select);
    section.appendChild(wrapper);
  }

  // Aggiunge una checkbox
  addCheckbox(
    sectionId: string,
    label: string,
    defaultValue: boolean,
    onChange: (value: boolean) => void
  ) {
    const section = this.sections[sectionId];
    if (!section) return;

    const wrapper = document.createElement("div");
    wrapper.className = "sidebar-input";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = defaultValue;

    const lbl = document.createElement("label");
    lbl.textContent = label;

    input.addEventListener("change", () => onChange(input.checked));

    wrapper.appendChild(input);
    wrapper.appendChild(lbl);
    section.appendChild(wrapper);
  }
}
