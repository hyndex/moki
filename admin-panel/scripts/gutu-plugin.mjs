#!/usr/bin/env node
/* eslint-disable no-console */
/** `gutu plugin` CLI — scaffold / validate / list plugins.
 *
 *  Usage (from admin-panel/):
 *    node scripts/gutu-plugin.mjs create <id> [--label "My Plugin"]
 *    node scripts/gutu-plugin.mjs list
 *    node scripts/gutu-plugin.mjs validate <id>
 *    node scripts/gutu-plugin.mjs help
 *
 *  Creates a new plugin under `src/plugins/<id>/` using the template in
 *  `src/plugins/_template/`. The plugin is picked up automatically on the
 *  next dev-server restart (filesystem discovery).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLUGINS_DIR = path.join(ROOT, "src", "plugins");
const TEMPLATE_DIR = path.join(PLUGINS_DIR, "_template");

const COLORS = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  blue:  "\x1b[34m",
  yellow:"\x1b[33m",
};

function log(color, ...args) {
  console.log(color + args.join(" ") + COLORS.reset);
}

/* ======================= commands ======================= */

async function cmdCreate(id, opts) {
  if (!id) return die("Missing plugin id. Usage: create <reverse-dns-id>");
  if (!/^[a-z][a-z0-9.-]*\.[a-z][a-z0-9.-]*/.test(id))
    log(COLORS.yellow, `⚠ id "${id}" doesn't look reverse-DNS (e.g. com.acme.foo) — ok to proceed, but recommended.`);
  const slug = id.split(".").pop() || id;
  const label = opts.label || toTitleCase(slug);
  const dir = path.join(PLUGINS_DIR, slug);
  if (await exists(dir)) die(`Directory already exists: ${dir}`);
  await fs.mkdir(dir, { recursive: true });

  const indexSrc = [
    `/** ${label} — auto-scaffolded plugin. Edit freely. */`,
    ``,
    `import { definePlugin } from "@/contracts/plugin-v2";`,
    ``,
    `export default definePlugin({`,
    `  manifest: {`,
    `    id: ${JSON.stringify(id)},`,
    `    version: "0.1.0",`,
    `    label: ${JSON.stringify(label)},`,
    `    description: "Describe what this plugin does.",`,
    `    icon: "Plug",`,
    `    requires: {`,
    `      shell: "^2.0.0",`,
    `      capabilities: ["nav", "commands"],`,
    `    },`,
    `    origin: { kind: "filesystem", location: "src/plugins/${slug}" },`,
    `  },`,
    ``,
    `  async activate(ctx) {`,
    `    ctx.runtime.logger.info("${label} activating…");`,
    ``,
    `    ctx.contribute.commands([`,
    `      {`,
    `        id: "${id}.hello",`,
    `        label: "${label}: Hello",`,
    `        icon: "Sparkles",`,
    `        run: () => ctx.runtime.notify({ title: "Hello from ${label}!", intent: "success" }),`,
    `      },`,
    `    ]);`,
    `  },`,
    `});`,
    ``,
  ].join("\n");

  const readme = [
    `# ${label}`,
    ``,
    `A plugin for the gutu admin panel.`,
    ``,
    `## Developing`,
    ``,
    `Drop this folder anywhere under \`admin-panel/src/plugins/\`. The shell`,
    `auto-discovers it via \`import.meta.glob\` on the next dev-server restart.`,
    ``,
    `## Contributing views, resources, actions`,
    ``,
    `See \`src/plugins/warehouse/index.tsx\` for a full end-to-end example.`,
    ``,
    `## Manifest`,
    ``,
    `Declare \`capabilities\` the plugin needs so the shell can enforce them:`,
    ``,
    `- \`nav\` — contribute sidebar nav`,
    `- \`commands\` — contribute command-palette entries`,
    `- \`resources:read/write/delete\` — read + mutate records`,
    `- \`shortcuts\` — register keyboard shortcuts`,
    `- \`register:field-kind\` — extend the fieldKinds registry`,
    `- \`fetch:external\` — make cross-origin requests`,
    ``,
  ].join("\n");

  const readmeReadme = [
    `# Plugin manifest`,
    ``,
    `- \`id\`: ${id}`,
    `- \`label\`: ${label}`,
    `- \`version\`: 0.1.0`,
    ``,
  ].join("\n");

  await fs.writeFile(path.join(dir, "index.tsx"), indexSrc);
  await fs.writeFile(path.join(dir, "README.md"), readme + "\n\n---\n\n" + readmeReadme);

  log(COLORS.green, `✓ Created ${path.relative(ROOT, dir)}`);
  log(COLORS.dim, `  • index.tsx`);
  log(COLORS.dim, `  • README.md`);
  log(COLORS.blue, `\nNext steps:`);
  log(COLORS.dim, `  1. Open ${path.relative(ROOT, path.join(dir, "index.tsx"))}`);
  log(COLORS.dim, `  2. Restart the dev server (or trigger HMR)`);
  log(COLORS.dim, `  3. Visit /settings/plugins — your plugin appears in the Inspector`);
}

async function cmdList() {
  const entries = await fs.readdir(PLUGINS_DIR).catch(() => []);
  const plugins = [];
  for (const entry of entries) {
    if (entry.startsWith("_")) continue;
    const dir = path.join(PLUGINS_DIR, entry);
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const index = await findIndex(dir);
    if (!index) continue;
    const src = await fs.readFile(index, "utf-8");
    const idMatch = src.match(/id:\s*["']([^"']+)["']/);
    const versionMatch = src.match(/version:\s*["']([^"']+)["']/);
    const labelMatch = src.match(/label:\s*["']([^"']+)["']/);
    plugins.push({
      folder: entry,
      id: idMatch?.[1] ?? "(unknown)",
      version: versionMatch?.[1] ?? "(unknown)",
      label: labelMatch?.[1] ?? entry,
    });
  }
  if (plugins.length === 0) {
    log(COLORS.dim, "No plugins in src/plugins/ yet. Run `create <id>` to scaffold one.");
    return;
  }
  log(COLORS.bold, "Discovered plugins:");
  for (const p of plugins) {
    log(COLORS.reset, `  ${p.folder.padEnd(20)} ${COLORS.blue}${p.id}${COLORS.reset} v${p.version} — ${p.label}`);
  }
}

async function cmdValidate(id) {
  if (!id) return die("Usage: validate <plugin-id-or-folder>");
  const dir = path.join(PLUGINS_DIR, id);
  const index = await findIndex(dir);
  if (!index) return die(`No index file in ${dir}`);
  const src = await fs.readFile(index, "utf-8");
  const checks = [
    ["exports default", /export\s+default\s+/.test(src)],
    ["has manifest.id", /id:\s*["'][^"']+["']/.test(src)],
    ["has manifest.version", /version:\s*["'][^"']+["']/.test(src)],
    ["has manifest.label", /label:\s*["'][^"']+["']/.test(src)],
    ["has activate()", /activate\s*\(/.test(src)],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    if (pass) log(COLORS.green, "✓", label);
    else {
      log(COLORS.red, "✗", label);
      ok = false;
    }
  }
  process.exit(ok ? 0 : 1);
}

function cmdHelp() {
  console.log(`
${COLORS.bold}gutu-plugin — plugin scaffolding CLI${COLORS.reset}

  ${COLORS.blue}create${COLORS.reset} <id> [--label "Label"]
    Scaffold a new plugin under src/plugins/<slug>/

  ${COLORS.blue}list${COLORS.reset}
    List every plugin folder under src/plugins/

  ${COLORS.blue}validate${COLORS.reset} <folder>
    Sanity-check a plugin's index file

  ${COLORS.blue}help${COLORS.reset}
    Show this message

${COLORS.dim}Example:${COLORS.reset}
  node scripts/gutu-plugin.mjs create com.acme.loyalty --label "Loyalty Program"
`);
}

/* ======================= helpers ======================= */

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function findIndex(dir) {
  for (const ext of ["tsx", "ts", "jsx", "js"]) {
    const p = path.join(dir, `index.${ext}`);
    if (await exists(p)) return p;
  }
  return null;
}

function toTitleCase(s) {
  return s.split(/[-_]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    }
  }
  return out;
}

function die(msg) {
  log(COLORS.red, msg);
  process.exit(1);
}

/* ======================= entry ======================= */
const [, , cmd, ...rest] = process.argv;
const flags = parseFlags(rest.filter((a) => a.startsWith("--") || rest[rest.indexOf(a) - 1]?.startsWith("--")));
const positional = rest.filter((a) => !a.startsWith("--") && !rest[rest.indexOf(a) - 1]?.startsWith("--"));

void TEMPLATE_DIR;

switch (cmd) {
  case "create":   await cmdCreate(positional[0], flags); break;
  case "list":     await cmdList(); break;
  case "validate": await cmdValidate(positional[0]); break;
  case "help":
  case undefined:  cmdHelp(); break;
  default:         die(`Unknown command: ${cmd}`);
}
