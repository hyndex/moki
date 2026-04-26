import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import path from "node:path";
import fs from "node:fs";

/** Read `package.json`'s `gutuPlugins` array and expose it as
 *  `import.meta.env.VITE_GUTU_PLUGINS` (CSV). This lets plugin authors
 *  publish to npm and have the shell auto-pick them up — they just add
 *  `"gutuPlugins": ["@acme/gutu-foo"]` to package.json. */
function readGutuPlugins(): string {
  try {
    const pkgPath = path.resolve(__dirname, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      gutuPlugins?: string[];
    };
    return (pkg.gutuPlugins ?? []).filter(Boolean).join(",");
  } catch {
    return "";
  }
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_GUTU_PLUGINS": JSON.stringify(readGutuPlugins()),
  },
  // vanillaExtractPlugin is kept for any `.css.ts` files we author
  // ourselves (none today, but the plugin chain is harmless when no
  // matching files exist). React plugin handles JSX/TSX + HMR.
  plugins: [vanillaExtractPlugin(), react()],
  resolve: {
    extensions: [".mjs", ".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gutu/admin-shell-next": path.resolve(__dirname, "./packages/admin-shell-next/src/index.ts"),
      // Plugin UI contributions resolve through @gutu-plugin-ui/<code>.
      // Each entry points at the plugin's host-plugin/ui/index.ts barrel.
      "@gutu-host/plugin-ui-contract": path.resolve(__dirname, "./src/host/plugin-ui-contract.ts"),
      "@gutu-plugin-ui/forms-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-forms-core/framework/builtin-plugins/forms-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/template-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-template-core/framework/builtin-plugins/template-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/notifications-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-notifications-core/framework/builtin-plugins/notifications-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/integration-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/webhooks-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-webhooks-core/framework/builtin-plugins/webhooks-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/auth-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-auth-core/framework/builtin-plugins/auth-core/src/host-plugin/ui/index.ts",
      ),
      "@gutu-plugin-ui/workflow-core": path.resolve(
        __dirname,
        "../plugins/gutu-plugin-workflow-core/framework/builtin-plugins/workflow-core/src/host-plugin/ui/index.ts",
      ),
    },
  },
  // Multi-page entry: the main shell + a separate /editor-frame.html that
  // hosts each Univer / TipTap editor in its own React root (no
  // StrictMode), insulating the host shell from upstream lifecycle bugs.
  appType: "mpa",
  build: {
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "./index.html"),
        editorFrame: path.resolve(__dirname, "./editor-frame.html"),
      },
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
      // Real-time editor sync (Yjs over WebSocket) — must proxy ws so
      // the upgrade reaches the backend's per-doc room handler.
      "/api/yjs": {
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
});
