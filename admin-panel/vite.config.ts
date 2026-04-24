import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gutu/admin-shell-next": path.resolve(__dirname, "./packages/admin-shell-next/src/index.ts"),
      "@gutu/admin-shell-bridge": path.resolve(__dirname, "./packages/admin-shell-bridge/src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api/ws": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:3333",
        changeOrigin: true,
        ws: true,
      },
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:3333",
        changeOrigin: true,
      },
    },
  },
  build: { sourcemap: true, target: "es2022" },
});
