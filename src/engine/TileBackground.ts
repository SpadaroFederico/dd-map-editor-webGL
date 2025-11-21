import * as PIXI from "pixi.js";
import { SCALE_MODES } from "pixi.js";

export class TileBackground {
  container: PIXI.Container;
  tileSize: number;
  tilesPerRow: number;
  tilesPerCol: number;
  textures: PIXI.Texture[] = [];

  public ready: Promise<void>;

  constructor(
    app: PIXI.Application,
    type: "grass" | "dirt" | "water",
    tileSize = 512,
    worldSize = 2072
  ) {
    this.container = new PIXI.Container();
    this.tileSize = tileSize;

    this.tilesPerRow = Math.ceil(worldSize / tileSize);
    this.tilesPerCol = Math.ceil(worldSize / tileSize);

    // Percorsi texture
    let texturePaths: string[] = [];
    if (type === "dirt") {
      texturePaths = Array.from({ length: 15 }, (_, i) =>
        `src/assets/tiles/dirt/dirt_stylized_rock_${i + 1}.png`
      );
    } else {
      texturePaths = Array.from({ length: 15 }, (_, i) =>
        `src/assets/tiles/${type}/${type}_${i + 1}.png`
      );
    }

    // 🔥 FIX IMPORTANTE:
    // ready = caricamento texture + generazione tile
    this.ready = PIXI.Assets.load(texturePaths).then(() => {
      this.textures = texturePaths.map((p) => {
        const tex = PIXI.Assets.get(p) as PIXI.Texture;

        if (type === "grass") {
          tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
          tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        } else {
          tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
          tex.baseTexture.scaleMode = SCALE_MODES.NEAREST;
        }

        tex.updateUvs();
        return tex;
      });

      // 🔥 genera i tile SOLO quando le texture sono cariche
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
        texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF; // 🔹 disattiva mipmap
        texture.baseTexture.scaleMode = SCALE_MODES.NEAREST; // 🔹 nessuna interpolazione
        texture.updateUvs(); // 🔹 forza aggiornamento UVs

        const sprite = new PIXI.Sprite(texture);
        sprite.scale.set(1); // 512 * 0.25 = 128 px visivi per tile
        sprite.x = x * this.tileSize;
        sprite.y = y * this.tileSize;
        sprite.width = this.tileSize;
        sprite.height = this.tileSize;
        this.container.addChild(sprite);
      }
    }
  }
}
