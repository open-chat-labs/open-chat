import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { classifyInheritedFormatting } from "./frontend_format_inherited.mjs";

// Use the reconciled feature boundary, not an advisory baseline or the previous
// push. NUL-delimited Git paths preserve spaces and non-ASCII names, and deleted
// paths have no candidate content for the formatter to check.
export function candidateFormattingPaths(
  { root, comparisonBase, ci = false },
  execute = spawnSync,
) {
  if (!/^[a-f0-9]{40}$/u.test(comparisonBase ?? "")) {
    throw new Error(
      "An explicit full formatting comparison commit is required.",
    );
  }
  const directory = resolve(root);
  const git = (args) => {
    const result = execute(
      process.platform === "win32" ? "git.exe" : "git",
      ["-c", `safe.directory=${directory.replaceAll("\\", "/")}`, ...args],
      { cwd: directory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `Git formatting scope failed: ${result.error?.message ?? result.stderr ?? "unknown error"}`,
      );
    }
    return result.stdout.split("\0").filter(Boolean);
  };
  const paths = git([
    "diff",
    "--name-only",
    "--diff-filter=ACMRT",
    "-z",
    ci ? `${comparisonBase}...HEAD` : comparisonBase,
    "--",
  ]);
  if (!ci)
    paths.push(...git(["ls-files", "--others", "--exclude-standard", "-z"]));
  return [...new Set(paths)].sort();
}

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

// Windows local checkouts may use CRLF. CI always retains Prettier's strict LF
// default; neither branch changes the repository formatter configuration.
export function frontendFormattingLineEndingArgs({ platform, ci }) {
  return platform === "win32" && !ci ? ["--end-of-line=auto"] : [];
}

const plain = (text = "") => text.replace(/\u001b\[[0-9;]*m/gu, "");
const details = (result) =>
  `${result.error?.message ?? ""}\n${result.stdout ?? ""}${result.stderr ?? ""}`;
const hasCommandError = (result) =>
  result.error || result.signal || result.status !== 1;
const knownDiagnostic = "[warn] svelteBracketNewLine is deprecated.";

// A mixed-EOL Windows checkout can still fail --end-of-line=auto. Recheck its
// exact content with only CRLF normalized, through the same CLI and filepath
// configuration. The caller never enables this diagnostic in CI.
export function checkLfNormalizedFormatting(
  frontendRoot,
  path,
  execute = spawnSync,
) {
  const source = readFileSync(resolve(frontendRoot, path), "utf8");
  if (!source.includes("\r\n")) return false;
  const result = execute(
    process.execPath,
    [
      resolve(frontendRoot, "node_modules/prettier/bin/prettier.cjs"),
      "--plugin=prettier-plugin-svelte",
      "--check",
      "--stdin-filepath",
      resolve(frontendRoot, path),
      "--end-of-line=lf",
    ],
    {
      cwd: frontendRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      input: source.replaceAll("\r\n", "\n"),
    },
  );
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(`LF-normalized formatter failed: ${details(result)}`);
  }
  if (result.status === 1) return false;
  if (
    plain(result.stderr)
      .split(/\r?\n/u)
      .filter(Boolean)
      .some((line) => line !== knownDiagnostic)
  ) {
    throw new Error(
      `Unexpected LF-normalized formatter diagnostic: ${details(result)}`,
    );
  }
  return true;
}

function differingPaths(result, batch) {
  if (hasCommandError(result))
    throw new Error(`Formatter mismatch listing failed: ${details(result)}`);
  const diagnostics = plain(result.stderr).split(/\r?\n/u).filter(Boolean);
  if (diagnostics.some((line) => line !== knownDiagnostic)) {
    throw new Error("Unexpected formatter mismatch-list diagnostic");
  }
  const paths = plain(result.stdout).split(/\r?\n/u).filter(Boolean);
  const selected = new Set(batch.map((path) => path.replaceAll("\\", "/")));
  const normalized = paths.map((path) => path.replaceAll("\\", "/"));
  if (
    !normalized.length ||
    new Set(normalized).size !== normalized.length ||
    normalized.some((path) => !selected.has(path))
  ) {
    throw new Error("Unexpected or empty formatter mismatch-list output");
  }
  return normalized;
}

// An exact root-config hash does not cover nested configs or EditorConfig.
// Ask the same CLI which config it actually discovers, and require the reviewed
// root config with no additional EditorConfig influence anywhere above the file.
function assertReviewedFormatterConfig(frontendRoot, path, execute) {
  const result = execute(
    process.execPath,
    [
      resolve(frontendRoot, "node_modules/prettier/bin/prettier.cjs"),
      "--find-config-path",
      resolve(frontendRoot, path),
    ],
    { cwd: frontendRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const paths = plain(result.stdout).split(/\r?\n/u).filter(Boolean);
  if (
    result.error ||
    result.signal ||
    result.status !== 0 ||
    plain(result.stderr).trim() ||
    paths.length !== 1 ||
    resolve(frontendRoot, paths[0]) !== resolve(frontendRoot, ".prettierrc")
  ) {
    throw new Error(
      `Effective formatter config is not the exact reviewed root config: ${details(result)}`,
    );
  }
  for (
    let directory = dirname(resolve(frontendRoot, path));
    ;
    directory = dirname(directory)
  ) {
    if (existsSync(resolve(directory, ".editorconfig"))) {
      throw new Error(
        `Unreviewed EditorConfig influence prevents inherited formatting acceptance: ${directory}`,
      );
    }
    if (dirname(directory) === directory) break;
  }
}

function inspectInheritedDebt(frontendRoot, path, inheritedBase, execute) {
  assertReviewedFormatterConfig(frontendRoot, path, execute);
  const root = resolve(frontendRoot, "..");
  // The source checkout determines the slice. No environment variable or caller
  // supplied scope can opt this repository into another slice's review records.
  const scope = existsSync(
    resolve(root, "scripts/check_openchat_pr2_security.mjs"),
  )
    ? "pr2"
    : "pr1";
  const candidatePath = `frontend/${path}`;
  const base = execute(
    process.platform === "win32" ? "git.exe" : "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "show",
      `${inheritedBase}:${candidatePath}`,
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (base.error || base.signal || base.status !== 0) {
    throw new Error(`Inherited formatting base read failed: ${details(base)}`);
  }
  const version = (name) =>
    JSON.parse(
      readFileSync(
        resolve(frontendRoot, "node_modules", name, "package.json"),
        "utf8",
      ),
    ).version;
  return classifyInheritedFormatting({
    scope,
    path: candidatePath,
    baseCommit: inheritedBase,
    baseSource: base.stdout,
    candidateSource: readFileSync(resolve(frontendRoot, path), "utf8"),
    formatter: {
      prettierVersion: version("prettier"),
      sveltePluginVersion: version("prettier-plugin-svelte"),
      configSource: readFileSync(resolve(frontendRoot, ".prettierrc"), "utf8"),
    },
  });
}

export function checkFrontendFormatting(
  frontendRoot,
  paths,
  execute = spawnSync,
  { inheritedBase, report = console.log } = {},
) {
  const failures = [];
  const endingArgs = frontendFormattingLineEndingArgs({
    platform: process.platform,
    ci: process.env.CI === "true",
  });
  const format = (mode, batch) =>
    execute(
      process.execPath,
      [
        resolve(frontendRoot, "node_modules/prettier/bin/prettier.cjs"),
        "--plugin=prettier-plugin-svelte",
        mode,
        ...endingArgs,
        ...batch,
      ],
      { cwd: frontendRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
  for (const batch of formatArgumentBatches(paths)) {
    // Always execute the ordinary CLI check before considering an inherited
    // mismatch. Parse/configuration/spawn errors never enter the debt path.
    const result = format("--check", batch);
    if (!result.error && !result.signal && result.status === 0) continue;
    if (
      hasCommandError(result) ||
      !/^[a-f0-9]{40}$/u.test(inheritedBase ?? "")
    ) {
      failures.push(details(result));
      continue;
    }
    let mismatches;
    try {
      const listed = format("--list-different", batch);
      mismatches = differingPaths(listed, batch);
    } catch (error) {
      failures.push(`${details(result)}\n${error.message}`);
      continue;
    }
    for (const path of mismatches) {
      try {
        if (
          process.env.CI === "true" &&
          readFileSync(resolve(frontendRoot, path), "utf8").includes("\r\n")
        ) {
          throw new Error(
            "CI formatter requires LF checkout content; inherited review does not waive EOL policy.",
          );
        }
        if (
          endingArgs.length &&
          checkLfNormalizedFormatting(frontendRoot, path, execute)
        ) {
          report(
            `Formatting: local checkout EOL-only difference ${path}; LF-normalized CLI content check passed. CI retains strict LF.`,
          );
          continue;
        }
        const review = inspectInheritedDebt(
          frontendRoot,
          path,
          inheritedBase,
          execute,
        );
        if (!review.accepted) {
          failures.push(
            `${path}: unaccepted formatting mismatch (${review.reason})`,
          );
          continue;
        }
        report(
          `Formatting: retained exact reviewed inherited debt ${review.reviewId}; base ${review.baseCommit}; candidate SHA-256 ${review.candidateSha256}. ${review.justification}`,
        );
      } catch (error) {
        failures.push(`${path}: ${error.message}`);
      }
    }
  }
  return failures;
}
