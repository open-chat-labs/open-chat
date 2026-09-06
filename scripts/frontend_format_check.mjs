import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Leave ample headroom under CreateProcess's UTF-16 limit, without cmd.exe's
// smaller limit. Count quoted/escaped arguments conservatively on every host.
export function formatArgumentBatches(paths, limit = 16000) {
  const batches = [];
  let batch = [];
  let length = 0;
  for (const path of paths) {
    const size = 2 * path.length + 3;
    if (size > limit)
      throw new Error("A formatter path exceeds the argument budget.");
    if (batch.length && length + size > limit) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(path);
    length += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function checkFrontendFormatting(
  frontendRoot,
  paths,
  execute = spawnSync,
) {
  const failures = [];
  for (const batch of formatArgumentBatches(paths)) {
    const result = execute(
      process.execPath,
      [
        resolve(frontendRoot, "node_modules/prettier/bin/prettier.cjs"),
        "--plugin=prettier-plugin-svelte",
        "--check",
        ...batch,
      ],
      { cwd: frontendRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    if (result.error || result.status !== 0) {
      failures.push(
        `${result.error?.message ?? ""}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
      );
    }
  }
  return failures;
}
