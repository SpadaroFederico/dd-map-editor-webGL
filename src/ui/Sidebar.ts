export class Sidebar {
  element: HTMLDivElement;
  onBaseChange: (type: "grass" | "dirt" | "water") => void;
  onBrushChange: (type: "grass" | "dirt" | "water") => void;
  onBrushSizeChange: (size: number) => void;

  constructor(
    onBaseChange: (type: "grass" | "dirt" | "water") => void,
    onBrushChange: (type: "grass" | "dirt" | "water") => void,
    onBrushSizeChange: (size: number) => void
  ) {
    this.onBaseChange = onBaseChange;
    this.onBrushChange = onBrushChange;
    this.onBrushSizeChange = onBrushSizeChange;

    this.element = document.createElement("div");
    this.element.className = "sidebar-fantasy";
    this.element.innerHTML = `
      <h2>🗺️ Mappa</h2>

      <section>
        <h3>Terreno base</h3>
        <div class="btn-group">
          <button data-type="grass">🌿</button>
          <button data-type="dirt">🪨</button>
          <button data-type="water">💧</button>
        </div>
      </section>

      <section>
        <h3>Brush terreno</h3>
        <div class="btn-group">
          <button data-brush="grass">🌿</button>
          <button data-brush="dirt">🪨</button>
          <button data-brush="water">💧</button>
        </div>
      </section>

      <section>
        <h3>Dimensione brush</h3>
        <input id="brush-size" type="range" min="8" max="128" step="8" value="32" />
      </section>

      <section>
        <button id="reset-map">🔄 Rigenera</button>
      </section>
    `;

    document.body.appendChild(this.element);

    // Eventi
    this.element.querySelectorAll("[data-type]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const type = (btn as HTMLButtonElement).dataset.type as "grass" | "dirt" | "water";
        this.onBaseChange(type);
      })
    );

    this.element.querySelectorAll("[data-brush]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const type = (btn as HTMLButtonElement).dataset.brush as "grass" | "dirt" | "water";
        this.onBrushChange(type);
      })
    );

    const sizeInput = this.element.querySelector("#brush-size") as HTMLInputElement;
    sizeInput.addEventListener("input", () => {
      this.onBrushSizeChange(parseInt(sizeInput.value));
    });

    const resetButton = this.element.querySelector("#reset-map") as HTMLButtonElement;
    resetButton.addEventListener("click", () => this.onBaseChange("grass"));
  }
}
