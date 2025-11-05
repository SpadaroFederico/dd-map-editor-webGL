import { defineConfig } from "vite";

// Configurazione di base per il nostro progetto Pixi + TS
export default defineConfig({
  server: {
    port: 5173, // puoi cambiarla se serve
    open: true, // apre automaticamente il browser
  },
  assetsInclude: ["**/*.glsl"], // permette di importare shader GLSL
  build: {
    outDir: "dist",
  },
});
