import { defineConfig } from "vite"

// Tauri serves the dev frontend from this fixed port (tauri.conf.json devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "safari16", outDir: "dist-web", emptyOutDir: true },
})
