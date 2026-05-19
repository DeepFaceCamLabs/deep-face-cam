import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const HOST = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: HOST || false,
    hmr: HOST ? { protocol: "ws", host: HOST, port: 1421 } : undefined,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/backend/.venv/**",
        "**/backend/models/**",
        "**/backend/**/__pycache__/**",
      ],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
