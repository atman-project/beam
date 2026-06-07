import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri mobile sets TAURI_DEV_HOST to the LAN IP so the phone can reach Vite.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    fs: { allow: [".."] },
  },
  build: {
    target: "esnext",
  },
});
