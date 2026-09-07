#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = fileURLToPath(
  new URL("../frontend/", import.meta.url),
);

export function androidDevArguments(environment, forwardedArguments = []) {
  const separator = forwardedArguments.indexOf("--");
  const options =
    separator === -1
      ? forwardedArguments
      : forwardedArguments.slice(0, separator);
  const runnerArguments =
    separator === -1 ? [] : forwardedArguments.slice(separator);
  const inspect =
    ["1", "true"].includes(environment.OC_DEVTOOLS) &&
    !options.includes("--release");
  return [
    "android",
    "dev",
    "--no-watch",
    ...options,
    ...(inspect ? ["--features=devtools"] : []),
    ...runnerArguments,
  ];
}

export function runAndroidDev(
  environment,
  forwardedArguments,
  spawn = spawnSync,
) {
  // Use the repository-installed CLI, not an unrelated global cargo-tauri.
  const require = createRequire(resolve(frontendDirectory, "package.json"));
  const cli = require.resolve("@tauri-apps/cli/tauri.js");
  return spawn(
    process.execPath,
    [cli, ...androidDevArguments(environment, forwardedArguments)],
    {
      cwd: frontendDirectory,
      env: environment,
      stdio: "inherit",
      shell: false,
    },
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = runAndroidDev(process.env, process.argv.slice(2));
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(`Unable to start Android development: ${error.message}`);
    process.exitCode = 1;
  }
}
