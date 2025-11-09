// src/terrain/terrainMesh.ts
import * as PIXI from "pixi.js";
import type { MultiPolygon, Polygon, Ring } from "./terrainArea";

export class TerrainMesh {
  public container: PIXI.Container;

  private app: PIXI.Application;
  private geometry: PIXI.Geometry | null = null;
  private mesh: PIXI.Mesh | null = null;
  private material: PIXI.MeshMaterial | null = null;
  private texture: PIXI.Texture | null = null;

  private repeatScale: number;

  constructor(app: PIXI.Application, repeatScale = 1) {
    this.app = app;
    this.container = new PIXI.Container();
    this.repeatScale = repeatScale;
  }

  setRepeatScale(s: number) {
    this.repeatScale = Math.max(0.01, s);
  }

  async setTextureFromUrl(url: string) {
    const tex = await PIXI.Assets.load<PIXI.Texture>(url);
    tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
    this.texture = tex;

    if (!this.material) {
      this.material = new PIXI.MeshMaterial(this.texture ?? PIXI.Texture.WHITE);
    } else {
      this.material.texture = this.texture ?? PIXI.Texture.WHITE;
    }
  }

  /** Usa tinta unita (niente texture) - non usata ora, ma pronta */
  setSolidColor(color: number, alpha = 1) {
    if (!this.material) {
      this.material = new PIXI.MeshMaterial(PIXI.Texture.WHITE);
    }
    this.texture = null;
    this.material.texture = PIXI.Texture.WHITE;
    this.material.tint = color;
    this.material.alpha = alpha;
  }

  update(mp: MultiPolygon) {
    const { positions, uvs, indices, use32 } = this.buildBuffers(mp);

    const numVerts = positions.length / 2;
    if (numVerts === 0 || indices.length === 0) {
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    // sanity indici
    let maxIdx = -1;
    for (let i = 0; i < indices.length; i++) if (indices[i] > maxIdx) maxIdx = indices[i];
    if (maxIdx >= numVerts) {
      console.warn("[TerrainMesh] indice fuori range:", maxIdx, ">= numVerts", numVerts);
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    if (!this.geometry) {
      this.geometry = new PIXI.Geometry()
        .addAttribute("aVertexPosition", positions, 2)
        .addAttribute("aTextureCoord", uvs, 2)
        .addIndex(
          use32
            ? new PIXI.Buffer((new Uint32Array(indices)) as unknown as PIXI.IArrayBuffer, true, true)
            : new PIXI.Buffer((new Uint16Array(indices)) as unknown as PIXI.IArrayBuffer, true, true)
        );

      if (!this.material) {
        this.material = new PIXI.MeshMaterial(this.texture ?? PIXI.Texture.WHITE);
      }

      this.mesh = new PIXI.Mesh(this.geometry, this.material);
      this.container.addChild(this.mesh);
      this.mesh.visible = true;
      return;
    }

    // update
    const posBuf = this.geometry.getBuffer("aVertexPosition");
    const uvBuf = this.geometry.getBuffer("aTextureCoord");
    const idxBuf = this.geometry.getIndex();

    if (!posBuf || !uvBuf || !idxBuf) {
      this.container.removeChild(this.mesh!);
      this.mesh?.destroy({ children: false, texture: false, baseTexture: false });
      this.geometry?.destroy();
      this.geometry = null;
      this.mesh = null;
      this.update(mp);
      return;
    }

    posBuf.update(positions as unknown as PIXI.IArrayBuffer);
    uvBuf.update(uvs as unknown as PIXI.IArrayBuffer);

    const curIndex = this.geometry.getIndex();
    const curIs32 = curIndex.data instanceof Uint32Array;

    if (curIs32 !== use32) {
      curIndex.destroy();
      const newIndexBuf = use32
        ? new PIXI.Buffer((new Uint32Array(indices)) as unknown as PIXI.IArrayBuffer, true, true)
        : new PIXI.Buffer((new Uint16Array(indices)) as unknown as PIXI.IArrayBuffer, true, true);
      this.geometry.addIndex(newIndexBuf);
    } else {
      curIndex.update(
        (use32
          ? (new Uint32Array(indices))
          : (new Uint16Array(indices))) as unknown as PIXI.IArrayBuffer
      );
    }

    if (this.mesh) this.mesh.visible = true;
  }

  // ---------- triangolazione & UV ----------
  private buildBuffers(mp: MultiPolygon): {
    positions: number[];
    uvs: number[];
    indices: number[];
    use32: boolean;
  } {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertOffset = 0;

    for (const poly of mp) {
      if (!poly || !poly[0] || poly[0].length < 3) continue;

      const { flat, holeIndices } = this.flattenPolygon(poly);
      const local = PIXI.utils.earcut(flat, holeIndices, 2);
      if (local.length === 0) continue;

      for (let i = 0; i < flat.length; i += 2) {
        const x = flat[i];
        const y = flat[i + 1];
        positions.push(x, y);

        // UV non influiscono se usi solo il bordo, ma lasciamoli corretti
        const s = this.repeatScale / 128;
        uvs.push(x * s, y * s);
      }

      for (let i = 0; i < local.length; i++) {
        indices.push(local[i] + vertOffset);
      }

      vertOffset += flat.length / 2;
    }

    const numVerts = positions.length / 2;
    const use32 = numVerts > 65535;
    return { positions, uvs, indices, use32 };
  }

  private flattenPolygon(p: Polygon): { flat: number[]; holeIndices: number[] } {
    const flat: number[] = [];
    const holeIndices: number[] = [];

    this.pushRing(flat, p[0]); // outer
    for (let h = 1; h < p.length; h++) {
      holeIndices.push(flat.length / 2);
      this.pushRing(flat, p[h]); // holes
    }
    return { flat, holeIndices };
  }

  private pushRing(out: number[], ring: Ring) {
    if (!ring || ring.length < 3) return;
    for (let i = 0; i < ring.length; i++) {
      out.push(ring[i][0], ring[i][1]);
    }
  }

  destroy() {
    this.mesh?.destroy({ children: false, texture: false, baseTexture: false });
    this.geometry?.destroy();
    this.material?.destroy();
    this.texture?.destroy();
    this.container.destroy({ children: true });
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.texture = null;
  }
}
