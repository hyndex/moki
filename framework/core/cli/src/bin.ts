#!/usr/bin/env node

import { runCli } from "./index";

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
});

process.exit(exitCode);
