// src/main.ts

import { createInitialEditorState, TOOL_ID } from './core/state';
import { EditorRenderer } from './rendering/renderer';
import { CameraController } from './input/cameraController';
import { StampBrushEngine } from './core/brush';
import { PolygonClippingGeometryEngine } from './core/geometry';
import { ShovelTool } from './core/tools/shovelTool';
import { BrushStrokeController } from './input/brushStrokeController';

// import './styles.css';

async function main(): Promise<void> {
  const editorState = createInitialEditorState();

  const root = document.getElementById('app');
  if (!root) {
    console.error('Elemento #app non trovato in index.html');
    return;
  }

  root.innerHTML = '';

  const info = document.createElement('div');
  info.style.position = 'fixed';
  info.style.top = '8px';
  info.style.left = '8px';
  info.style.zIndex = '10';
  info.style.color = 'white';
  info.style.fontFamily = 'sans-serif';
  info.textContent =
    '2D Map Editor – dirt + shovel – pan/zoom: destro/centrale, sinistro: tool attivo (Shovel/Paint)';
  root.appendChild(info);

  // 🔘 Bottone temporaneo per switch Shovel / Paint
  const toggleBtn = document.createElement('button');
  toggleBtn.style.position = 'fixed';
  toggleBtn.style.top = '32px';
  toggleBtn.style.left = '8px';
  toggleBtn.style.zIndex = '11';
  toggleBtn.style.padding = '4px 8px';
  toggleBtn.style.fontFamily = 'sans-serif';
  toggleBtn.style.fontSize = '12px';
  toggleBtn.style.cursor = 'pointer';

  function updateToggleLabel() {
    if (editorState.activeTool === TOOL_ID.Paint) {
      toggleBtn.textContent = 'Tool: Paint (BG)';
    } else {
      toggleBtn.textContent = 'Tool: Shovel';
    }
  }

  // giusto per sicurezza, anche se createInitialEditorState lo setta già a Shovel
  if (!editorState.activeTool) {
    editorState.activeTool = TOOL_ID.Shovel;
  }
  updateToggleLabel();

  toggleBtn.addEventListener('click', () => {
    editorState.activeTool =
      editorState.activeTool === TOOL_ID.Shovel
        ? TOOL_ID.Paint
        : TOOL_ID.Shovel;

    updateToggleLabel();
    console.log('Tool attivo:', editorState.activeTool);
  });

  root.appendChild(toggleBtn);

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  root.appendChild(canvas);

  const brushEngine = StampBrushEngine;
  const geometryEngine = PolygonClippingGeometryEngine;

  const shovelTool = new ShovelTool(brushEngine, geometryEngine);

  const renderer = new EditorRenderer(editorState, shovelTool, {
    canvas,
  });

  const cameraController = new CameraController(
    editorState,
    renderer,
    canvas,
  );

  const brushController = new BrushStrokeController(
    editorState,
    renderer,
    shovelTool,
    canvas,
  );

  await renderer.init();

  // debug
  (window as any).editorState = editorState;
  (window as any).renderer = renderer;
  (window as any).cameraController = cameraController;
  (window as any).shovelTool = shovelTool;
  (window as any).brushController = brushController;
}

main().catch((err) => {
  console.error('Errore in main():', err);
});
