export class Sidebar {
  element: HTMLDivElement;
  onBaseChange: (type: "grass" | "dirt" | "water") => void;
  onBrushChange: (type: "grass" | "dirt" | "water") => void;
  onBrushSizeChange: (size: number) => void;
  onBrushShapeChange: (shape: "circle" | "square" | "polygon") => void;
  onBrushRoughnessChange: (value: number) => void;
  onBrushEdgeVariationChange: (value: number) => void;
  onBrushNoiseChange: (value: number) => void;

  // stato attuale (per log unificato)
  private currentValues = {
    base: "grass",
    brush: "dirt",
    shape: "circle",
    size: 32,
    roughness: 10,
    edge: 20,
    noise: 10,
  };

  constructor(
    onBaseChange: (type: "grass" | "dirt" | "water") => void,
    onBrushChange: (type: "grass" | "dirt" | "water") => void,
    onBrushSizeChange: (size: number) => void,
    onBrushShapeChange: (shape: "circle" | "square" | "polygon") => void,
    onBrushRoughnessChange: (value: number) => void,
    onBrushEdgeVariationChange: (value: number) => void,
    onBrushNoiseChange: (value: number) => void
  ) {
    this.onBaseChange = onBaseChange;
    this.onBrushChange = onBrushChange;
    this.onBrushSizeChange = onBrushSizeChange;
    this.onBrushShapeChange = onBrushShapeChange;
    this.onBrushRoughnessChange = onBrushRoughnessChange;
    this.onBrushEdgeVariationChange = onBrushEdgeVariationChange;
    this.onBrushNoiseChange = onBrushNoiseChange;

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
        <h3>Forma pennello</h3>
        <div class="btn-group">
          <button data-shape="circle">⚪ Cerchio</button>
          <button data-shape="square">⬛ Quadrato</button>
          <button data-shape="polygon">🔷 Poligono</button>
        </div>
      </section>

      <section>
        <h3>Dimensione</h3>
        <input id="brush-size" type="range" min="8" max="128" step="8" value="32" />
      </section>

      <section>
        <h3>Parametri pennello</h3>
        <label>Ruvidezza</label>
        <input id="brush-roughness" type="range" min="1" max="40" step="1" value="10" />

        <label>Variazione bordi</label>
        <input id="brush-edge" type="range" min="0" max="100" step="1" value="20" />

        <label>Rumore</label>
        <input id="brush-noise" type="range" min="0" max="100" step="1" value="10" />
      </section>

      <section>
        <button id="reset-map">🔄 Rigenera</button>
      </section>
    `;

    document.body.appendChild(this.element);
    console.log("%c[Sidebar] Inizializzata ✅", "color:lime");

    // helper log
    const logCurrentValues = () => {
      console.clear();
      console.table(this.currentValues);
    };

    // terreno base
    this.element.querySelectorAll("[data-type]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const type = (btn as HTMLButtonElement).dataset.type as "grass" | "dirt" | "water";
        this.currentValues.base = type;
        this.onBaseChange(type);
        logCurrentValues();
      })
    );

    // tipo di brush
    this.element.querySelectorAll("[data-brush]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const type = (btn as HTMLButtonElement).dataset.brush as "grass" | "dirt" | "water";
        this.currentValues.brush = type;
        this.onBrushChange(type);
        logCurrentValues();
      })
    );

    // forma
    this.element.querySelectorAll("[data-shape]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const shape = (btn as HTMLButtonElement).dataset.shape as "circle" | "square" | "polygon";
        this.currentValues.shape = shape;
        this.onBrushShapeChange(shape);
        logCurrentValues();
      })
    );

    // dimensione
    const sizeInput = this.element.querySelector("#brush-size") as HTMLInputElement;
    sizeInput.addEventListener("input", () => {
      const val = parseInt(sizeInput.value);
      this.currentValues.size = val;
      this.onBrushSizeChange(val);
      logCurrentValues();
    });

    // roughness
    const roughInput = this.element.querySelector("#brush-roughness") as HTMLInputElement;
    roughInput.addEventListener("input", () => {
      const val = parseInt(roughInput.value);
      this.currentValues.roughness = val;
      this.onBrushRoughnessChange(val);
      logCurrentValues();
    });

    // edge variation
    const edgeInput = this.element.querySelector("#brush-edge") as HTMLInputElement;
    edgeInput.addEventListener("input", () => {
      const val = parseInt(edgeInput.value);
      this.currentValues.edge = val;
      this.onBrushEdgeVariationChange(val);
      logCurrentValues();
    });

    // noise
    const noiseInput = this.element.querySelector("#brush-noise") as HTMLInputElement;
    noiseInput.addEventListener("input", () => {
      const val = parseInt(noiseInput.value);
      this.currentValues.noise = val;
      this.onBrushNoiseChange(val);
      logCurrentValues();
    });

    // reset
    const resetButton = this.element.querySelector("#reset-map") as HTMLButtonElement;
    resetButton.addEventListener("click", () => {
      this.currentValues = {
        base: "grass",
        brush: "dirt",
        shape: "circle",
        size: 32,
        roughness: 10,
        edge: 20,
        noise: 10,
      };
      this.onBaseChange("grass");
      logCurrentValues();
    });
  }
}
