import * as PIXI from "pixi.js";
import { SCALE_MODES } from "pixi.js";

export class TileBackground {
  container: PIXI.Container;
  tileSize: number;
  tilesPerRow: number;
  tilesPerCol: number;
  textures: PIXI.Texture[] = [];

  constructor(
    app: PIXI.Application,
    type: "grass" | "dirt" | "water",
    tileSize = 128
  ) {
    this.container = new PIXI.Container();
    this.tileSize = tileSize;

    // Calcola quante tile servono per coprire l'area visibile
    this.tilesPerRow = Math.ceil(app.renderer.width / tileSize);
    this.tilesPerCol = Math.ceil(app.renderer.height / tileSize);

    // Percorsi texture
    const texturePaths = Array.from({ length: 15 }, (_, i) =>
      `src/assets/tiles/${type}/${type}_${i + 1}.png`
    );

    PIXI.Assets.load(texturePaths).then(() => {
      // Usa la cache per ottenere texture coerenti
      this.textures = texturePaths.map((p) => PIXI.Assets.get(p) as PIXI.Texture);
      this.generateTiles();
    });
  }

  generateTiles() {
    const lastUsed: number[][] = [];

    for (let y = 0; y < this.tilesPerCol; y++) {
      lastUsed[y] = [];

      for (let x = 0; x < this.tilesPerRow; x++) {
        let candidateIndex: number;
        let tries = 0;

        do {
          candidateIndex = Math.floor(Math.random() * this.textures.length);
          tries++;
        } while (
          (x > 0 && lastUsed[y][x - 1] === candidateIndex) ||
          (y > 0 && lastUsed[y - 1][x] === candidateIndex)
        );

        lastUsed[y][x] = candidateIndex;

        const texture = this.textures[candidateIndex];
        texture.baseTexture.scaleMode = SCALE_MODES.NEAREST; // ⬅ evita sfumature

        const sprite = new PIXI.Sprite(texture);
        sprite.x = x * this.tileSize;
        sprite.y = y * this.tileSize;
        sprite.width = this.tileSize;
        sprite.height = this.tileSize;
        this.container.addChild(sprite);
      }
    }
  }
}
