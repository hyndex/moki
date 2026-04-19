import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { runCli, scaffoldAiPack } from "../../src/index";

const repoRoot = resolve(import.meta.dir, "../../../../../");

function createMemoryIo(cwd = process.cwd()) {
  let stdout = "";
  let stderr = "";
  return {
    cwd,
    env: process.env,
    stdin: process.stdin,
    stdout: {
      write(chunk: string) {
        stdout += chunk;
      }
    },
    stderr: {
      write(chunk: string) {
        stderr += chunk;
      }
    },
    readStdout() {
      return stdout;
    },
    readStderr() {
      return stderr;
    }
  };
}

describe("platform cli", () => {
  it("runs an AI agent command and prints JSON", async () => {
    const io = createMemoryIo();
    const exitCode = await runCli(["agent", "run", "--goal", "Summarize open escalations with grounded next steps."], io);

    expect(exitCode).toBe(0);
    expect(io.readStdout()).toContain("\"runId\"");
  });

  it("diffs prompt bodies", async () => {
    const io = createMemoryIo();
    const exitCode = await runCli(
      [
        "prompt",
        "diff",
        "--left",
        "prompt-version:ops-triage:v3",
        "--right",
        "prompt-version:ops-triage:v4"
      ],
      io
    );

    expect(exitCode).toBe(0);
    expect(io.readStdout()).toContain("\"added\"");
  });

  it("inspects MCP descriptors", async () => {
    const io = createMemoryIo();
    const exitCode = await runCli(["mcp", "inspect", "--tool", "ai.memory.retrieve"], io);

    expect(exitCode).toBe(0);
    expect(io.readStdout()).toContain("\"ai.memory.retrieve\"");
  });

  it("scaffolds a new ai-pack", () => {
    const cwd = mkdtempSync(join(tmpdir(), "platform-cli-"));
    const target = scaffoldAiPack(cwd, "assistant-pack");

    expect(readFileSync(join(target, "package.ts"), "utf8")).toContain('id: "assistant-pack"');
    expect(readFileSync(join(target, "package.json"), "utf8")).toContain('"name": "@plugins/assistant-pack"');
    expect(readFileSync(join(target, "docs", "AGENT_CONTEXT.md"), "utf8")).toContain("Assistant Pack");
  });

  it("indexes and validates understanding docs for a known target", async () => {
    const io = createMemoryIo(repoRoot);
    const cwd = mkdtempSync(join(tmpdir(), "platform-cli-index-"));
    const indexPath = join(cwd, "understanding.json");
    const target = "framework/core/agent-understanding";

    const scaffoldIo = createMemoryIo(repoRoot);
    const scaffoldExitCode = await runCli(["docs", "scaffold", "--target", target], scaffoldIo);

    expect(scaffoldExitCode).toBe(0);

    const indexExitCode = await runCli(["docs", "index", "--target", target, "--out", indexPath], io);

    expect(indexExitCode).toBe(0);
    expect(readFileSync(indexPath, "utf8")).toContain("\"agent-understanding\"");

    const validateIo = createMemoryIo(repoRoot);
    const validateExitCode = await runCli(["docs", "validate", "--target", target], validateIo);

    expect(validateExitCode).toBe(0);
    expect(validateIo.readStdout()).toContain("\"ok\": true");
  });
});
