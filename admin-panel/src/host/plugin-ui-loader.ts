/** Frontend plugin lifecycle loader.
 *
 *  Mirrors the backend host loader (`backend/src/host/plugin-contract.ts`)
 *  but in the browser: drives install / start / stop with per-plugin
 *  isolation, tracks status, and exposes it for the /api/_plugins
 *  view to display alongside the backend records.
 *
 *  Discovery is build-time via Vite's alias map for now; at runtime
 *  this module just consumes the resolved contributions array. */

import type { AdminUiContribution } from "./plugin-ui-contract";

export type PluginUiStatus = "idle" | "installed" | "started" | "stopped" | "quarantined";

export interface PluginUiRecord {
  id: string;
  manifest: AdminUiContribution["manifest"];
  status: PluginUiStatus;
  errors: string[];
  installedAt: string | null;
  startedAt: string | null;
}

const RECORDS = new Map<string, PluginUiRecord>();
const INSTALL_KEY = "gutu.plugin-ui.installed";

function readInstalled(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(INSTALL_KEY) ?? "{}") as Record<string, string>; }
  catch { return {}; }
}
function writeInstalled(map: Record<string, string>): void {
  try { localStorage.setItem(INSTALL_KEY, JSON.stringify(map)); } catch {/* private mode */}
}

async function runIsolated(rec: PluginUiRecord, phase: string, fn: () => unknown | Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[plugin-ui] ${phase} failed for ${rec.id}:`, err);
    rec.status = "quarantined";
    rec.errors.push(`${phase}: ${msg}`);
    return false;
  }
}

/** Initialise records for every contribution. */
export function loadPluginUi(plugins: readonly AdminUiContribution[]): readonly AdminUiContribution[] {
  RECORDS.clear();
  const ok: AdminUiContribution[] = [];
  for (const p of plugins) {
    if (!p.id || typeof p.id !== "string") {
      console.warn("[plugin-ui] dropping contribution without id");
      continue;
    }
    if (RECORDS.has(p.id)) {
      console.warn(`[plugin-ui] duplicate plugin id "${p.id}" — ignoring later contribution`);
      continue;
    }
    RECORDS.set(p.id, {
      id: p.id,
      manifest: p.manifest,
      status: "idle",
      errors: [],
      installedAt: null,
      startedAt: null,
    });
    ok.push(p);
  }
  return ok;
}

/** Run install hooks once per browser, tracked in localStorage. */
export async function installPluginUiIfNeeded(plugins: readonly AdminUiContribution[]): Promise<void> {
  const installed = readInstalled();
  let mutated = false;
  for (const p of plugins) {
    const rec = RECORDS.get(p.id);
    if (!rec || rec.status === "quarantined") continue;
    if (!p.install) continue;
    if (installed[p.id]) continue;
    const ok = await runIsolated(rec, "install", () => p.install!());
    if (ok) {
      installed[p.id] = new Date().toISOString();
      rec.installedAt = installed[p.id]!;
      rec.status = "installed";
      mutated = true;
    }
  }
  if (mutated) writeInstalled(installed);
}

/** Fire start hooks. Quarantined plugins are skipped. */
export async function startPluginUi(plugins: readonly AdminUiContribution[]): Promise<void> {
  for (const p of plugins) {
    const rec = RECORDS.get(p.id);
    if (!rec || rec.status === "quarantined") continue;
    if (!p.start) continue;
    const ok = await runIsolated(rec, "start", () => p.start!());
    if (ok) {
      rec.startedAt = new Date().toISOString();
      rec.status = "started";
    }
  }
}

/** Fire stop hooks (HMR / sign-out). */
export async function stopPluginUi(plugins: readonly AdminUiContribution[]): Promise<void> {
  for (const p of plugins) {
    const rec = RECORDS.get(p.id);
    if (!rec) continue;
    if (!p.stop) { rec.status = "stopped"; continue; }
    await runIsolated(rec, "stop", () => p.stop!());
    rec.status = "stopped";
  }
}

export function listPluginUiRecords(): readonly PluginUiRecord[] {
  return [...RECORDS.values()];
}

export function getPluginUiRecord(id: string): PluginUiRecord | undefined {
  return RECORDS.get(id);
}
