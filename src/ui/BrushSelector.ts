export class BrushSelector {
  constructor(onChange: (size: number) => void) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.top = "10px";
    wrapper.style.right = "10px";
    wrapper.style.background = "rgba(0,0,0,0.6)";
    wrapper.style.color = "#fff";
    wrapper.style.padding = "8px";
    wrapper.style.borderRadius = "6px";
    wrapper.style.fontFamily = "sans-serif";
    wrapper.style.zIndex = "1000";

    const label = document.createElement("label");
    label.textContent = "Brush size:";
    wrapper.appendChild(label);

    const select = document.createElement("select");
    ["32", "64", "128"].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = `${s}px`;
      select.appendChild(opt);
    });
    select.value = "64";

    select.addEventListener("change", () => {
      onChange(parseInt(select.value));
    });

    wrapper.appendChild(select);
    document.body.appendChild(wrapper);
  }
}
