import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { vanillaExtractPlugin as veEsbuildPlugin } from "@vanilla-extract/esbuild-plugin";
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

// Auto-discover every installed @blocksuite/* package so we don't ship
// a hardcoded list that drifts with upstream releases. Only directories
// with `src/` are taken — that's the marker for the un-built BlockSuite
// packages that need vanilla-extract handling. Built sub-packages
// without `src/` (e.g. `@blocksuite/icons`) skip the BlockSuite chain.
function discoverBlockSuitePackages(): string[] {
  const root = path.resolve(__dirname, "node_modules/@blocksuite");
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith(".")) continue;
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!fs.existsSync(path.join(dir, "src"))) continue;
    out.push(`@blocksuite/${name}`);
  }
  return out;
}
const BLOCKSUITE_PKGS = discoverBlockSuitePackages();

export default defineConfig({
  define: {
    "import.meta.env.VITE_GUTU_PLUGINS": JSON.stringify(readGutuPlugins()),
  },
  // BlockSuite ships .css.ts files in its published packages; let the
  // Vite plugin transform them at request time. Pre-bundling via
  // optimizeDeps would route around the plugin, so exclude every
  // discovered BlockSuite package from optimizeDeps. The CJS shim deps
  // (extend, lodash-es, etc) still get pre-bundled normally.
  optimizeDeps: {
    exclude: BLOCKSUITE_PKGS,
    // CJS shims that the BlockSuite chain depends on must be pre-bundled
    // so they expose proper ESM `default` exports. Without this, the
    // editor mount fails with:
    //   "module '/node_modules/extend/index.js' does not provide an
    //    export named 'default'"
    include: [
      "extend",
      "lodash-es",
      "lib0",
      "lib0/promise",
      "lib0/observable",
      "lib0/encoding",
      "lib0/decoding",
      "yjs",
      "@lit/reactive-element",
      "@preact/signals-core",
      "lit",
      "lit-html",
      "lit/decorators.js",
      "lit/directives/keyed.js",
      "lit/directives/when.js",
    ],
    esbuildOptions: {
      plugins: [veEsbuildPlugin() as never],
    },
  },
  // vanillaExtractPlugin compiles `.css.ts` files used by BlockSuite/AFFiNE
  // (e.g. @blocksuite/affine-shared/styles). Without it, those files
  // import as plain TS and the editor mount fails with "Styles were
  // unable to be assigned to a file".
  plugins: [vanillaExtractPlugin(), react()],
  resolve: {
    extensions: [".mjs", ".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gutu/admin-shell-next": path.resolve(__dirname, "./packages/admin-shell-next/src/index.ts"),
    },
  },
  // Multi-page entry: the main shell + a separate /editor-frame.html that
  // hosts each Univer / BlockSuite editor in its own React root (no
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
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:3333",
        changeOrigin: true,
      },
    },
  },
});
