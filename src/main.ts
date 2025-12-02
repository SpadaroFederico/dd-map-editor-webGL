// src/main.ts

import { createInitialEditorState } from './core/state';
import { EditorRenderer } from './rendering/renderer';
import { CameraController } from './input/cameraController';
import { StampBrushEngine } from './core/brush';
import { PolygonClippingGeometryEngine } from './core/geometry';
import { ShovelTool } from './core/tools/shovelTool';
import { BrushStrokeController } from './input/brushStrokeController';
import { createSidebar } from './ui/sidebar';

async function main(): Promise<void> {
  const editorState = createInitialEditorState();

  const root = document.getElementById('app');
  if (!root) {
    console.error('Elemento #app non trovato in index.html');
    return;
  }

  root.innerHTML = '';

  // ===== INFO DI DEBUG =====
  const info = document.createElement('div');
  info.style.position = 'fixed';
  info.style.top = '8px';
  info.style.left = '8px';
  info.style.zIndex = '10';
  info.style.color = 'white';
  info.style.fontFamily = 'sans-serif';
  info.textContent =
    '2D Map Editor – pan/zoom: destro/centrale | sinistro: tool attivo (Shovel / Paint)';
  root.appendChild(info);

  // ===== SIDEBAR =====
  // (UI completa: tool, paint mode, materiali, brush settings)
  const sidebar = createSidebar(root, editorState, null as any); 
  // Renderer viene passato dopo la creazione effettiva


  // ===== CANVAS =====
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  root.appendChild(canvas);

  const brushEngine = StampBrushEngine;
  const geometryEngine = PolygonClippingGeometryEngine;

  const shovelTool = new ShovelTool(brushEngine, geometryEngine);

  // ===== RENDERER =====
  const renderer = new EditorRenderer(editorState, shovelTool, { canvas });

  // ora che renderer esiste, aggiorniamo la sidebar
  sidebar.setRenderer(renderer, shovelTool);

  // ===== CAMERA CONTROLLER =====
  const cameraController = new CameraController(
    editorState,
    renderer,
    canvas,
  );

  // ===== BRUSH CONTROLLER =====
  const brushController = new BrushStrokeController(
    editorState,
    renderer,
    shovelTool,
    canvas,
  );

  brushController.setPaintPolygonFactory((es, worldPos) =>
    shovelTool.createSingleStampPolygon(es, worldPos)
);


  await renderer.init();

  // ===== DEBUG GLOBAL =====
  (window as any).editorState = editorState;
  (window as any).renderer = renderer;
  (window as any).cameraController = cameraController;
  (window as any).shovelTool = shovelTool;
  (window as any).brushController = brushController;
}

main().catch((err) => {
  console.error('Errore in main():', err);
});
