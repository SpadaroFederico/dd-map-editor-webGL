export class LayerSelector {
  onSelect: (type: "grass" | "dirt" | "water") => void;

  constructor(onSelect: (type: "grass" | "dirt" | "water") => void) {
    this.onSelect = onSelect;
    this.render();
  }

  render() {
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.top = "10px";
    wrapper.style.left = "10px";
    wrapper.style.display = "flex";
    wrapper.style.gap = "10px";
    wrapper.style.zIndex = "100";

    const types: ("grass" | "dirt" | "water")[] = ["grass", "dirt", "water"];
    types.forEach((type) => {
      const btn = document.createElement("button");
      btn.textContent = type.toUpperCase();
      btn.style.padding = "6px 12px";
      btn.style.background = "#333";
      btn.style.color = "white";
      btn.style.border = "1px solid #666";
      btn.style.cursor = "pointer";
      btn.onclick = () => this.onSelect(type);
      wrapper.appendChild(btn);
    });

    document.body.appendChild(wrapper);
  }
}
