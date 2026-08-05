#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = resolve(
  root,
  ".github/security/openchat-pr1-security-baseline.json",
);
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const modes = new Set(process.argv.slice(2));
if (modes.size === 0) {
  modes.add("ci");
  modes.add("npm");
  modes.add("rust");
  modes.add("licenses");
  modes.add("format");
}

const failures = [];
for (const [path, expected] of Object.entries(policy.reviewedDependencyFiles)) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    failures.push("Reviewed dependency file is missing: " + path);
    continue;
  }
  const actual = createHash("sha256")
    .update(readFileSync(absolutePath))
    .digest("hex");
  if (actual !== expected) {
    failures.push(
      "Reviewed dependency file changed: " +
        path +
        " (" +
        actual +
        " != " +
        expected +
        "); re-audit before updating the baseline",
    );
  }
}
const today = new Date().toISOString().slice(0, 10);
if (today > policy.expiresOn) {
  failures.push(
    `Security baseline expired on ${policy.expiresOn}; re-audit and update ${policy.trackingIssue}`,
  );
}

function executable(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CARGO_TERM_COLOR: "never", NO_COLOR: "1" },
  });
  if (result.error) throw result.error;
  return result;
}

function runGit(args) {
  return run(executable("git"), [
    "-c",
    "safe.directory=" + root.split(String.fromCharCode(92)).join("/"),
    ...args,
  ]);
}

function outputLines(result) {
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function candidatePaths() {
  const comparisonBase = process.env.PR_BASE_SHA || policy.baseCommit;
  if (!comparisonBase) return [];
  const range =
    process.env.CI === "true" ? `${comparisonBase}...HEAD` : comparisonBase;
  const changed = runGit(["diff", "--name-only", range, "--"]);
  if (changed.status !== 0) {
    throw new Error(`git candidate path check failed: ${changed.stderr}`);
  }
  const paths = outputLines(changed);
  if (process.env.CI !== "true") {
    const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
    if (untracked.status !== 0) {
      throw new Error(`git untracked path check failed: ${untracked.stderr}`);
    }
    paths.push(...outputLines(untracked));
  }
  return [...new Set(paths)].sort();
}

function parseJsonOutput(result, label) {
  if (!result.stdout.trim()) {
    throw new Error(
      `${label} produced no JSON (exit ${result.status}): ${result.stderr}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `${label} returned invalid JSON: ${error.message}\n${result.stdout}`,
    );
  }
}

if (modes.has("ci")) {
  const workflowPath = resolve(
    root,
    ".github/workflows/on_device_model_security.yaml",
  );
  const workflow = readFileSync(workflowPath, "utf8");
  const declaredVersions = [
    ...workflow.matchAll(
      /node-version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?/gu,
    ),
  ].map((match) => match[1]);
  const expected = policy.ciRuntime.nodeVersion;
  const expectedMajor = Number(expected.split(".")[0]);
  if (expectedMajor < policy.ciRuntime.minimumSupportedMajor) {
    failures.push("PR1 policy pins an unsupported Node major: " + expected);
  }
  if (declaredVersions.length !== policy.ciRuntime.setupNodeOccurrences) {
    failures.push(
      "Expected " +
        policy.ciRuntime.setupNodeOccurrences +
        " setup-node pins; found " +
        declaredVersions.length,
    );
  }
  for (const declared of declaredVersions) {
    if (declared !== expected) {
      failures.push(
        "PR1 workflow Node version is " +
          declared +
          "; expected supported pin " +
          expected,
      );
    }
  }
  if (process.env.CI === "true" && process.versions.node !== expected) {
    failures.push(
      "CI Node runtime is " +
        process.versions.node +
        "; setup-node policy requires " +
        expected,
    );
  }
  console.log(
    "CI runtime: expected Node " +
      expected +
      "; declared " +
      JSON.stringify(declaredVersions),
  );
}

if (modes.has("format")) {
  const formatPolicy = policy.format;
  const extensions = new Set(formatPolicy.extensions);
  const excludedPrefixes = Object.keys(formatPolicy.excludedPrefixes);
  const excludedFiles = new Set(Object.keys(formatPolicy.excludedFiles));
  const changed = candidatePaths().filter((path) =>
    path.startsWith(formatPolicy.sourceRoot),
  );
  const isExcluded = (path) =>
    excludedFiles.has(path) ||
    excludedPrefixes.some((prefix) => path.startsWith(prefix));
  const excluded = changed.filter(isExcluded);
  const candidates = changed.filter(
    (path) => !isExcluded(path) && extensions.has(extname(path).toLowerCase()),
  );
  if (candidates.length) {
    const frontendRoot = resolve(root, "frontend");
    const prettierPaths = candidates.map((path) =>
      relative(frontendRoot, resolve(root, path))
        .split(String.fromCharCode(92))
        .join("/"),
    );
    const args = [
      "exec",
      "prettier",
      "--",
      "--plugin=prettier-plugin-svelte",
      "--check",
      ...prettierPaths,
    ];
    const result =
      process.platform === "win32"
        ? run(
            process.env.ComSpec ?? "cmd.exe",
            ["/d", "/s", "/c", "npm", ...args],
            frontendRoot,
          )
        : run("npm", args, frontendRoot);
    if (result.status !== 0) {
      failures.push(
        `Candidate source/config formatting failed:\n${result.stdout}${result.stderr}`,
      );
    }
  }
  console.log(
    `Formatting: checked ${candidates.length} candidate source/config files; excluded ${excluded.length} generated or native metadata files by policy`,
  );
}

function checkNpmAudit(label, extraArgs, maximum) {
  const args = ["audit", "--json", ...extraArgs];
  const result =
    process.platform === "win32"
      ? run(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npm", ...args],
          resolve(root, "frontend"),
        )
      : run("npm", args, resolve(root, "frontend"));
  const report = parseJsonOutput(result, `npm audit (${label})`);
  const actual = report.metadata?.vulnerabilities;
  if (!actual)
    throw new Error(`npm audit (${label}) omitted vulnerability metadata`);
  for (const severity of [
    "info",
    "low",
    "moderate",
    "high",
    "critical",
    "total",
  ]) {
    if (actual[severity] > maximum[severity]) {
      failures.push(
        `npm ${label} ${severity} findings increased: ${actual[severity]} > reviewed ${maximum[severity]}`,
      );
    }
  }
  console.log(`npm ${label}: ${JSON.stringify(actual)}`);
}

if (modes.has("npm")) {
  const comparisonBase = process.env.PR_BASE_SHA || policy.baseCommit;
  if (comparisonBase) {
    const changedResult = runGit([
      "diff",
      "--name-only",
      comparisonBase + "...HEAD",
      "--",
      "frontend",
    ]);
    if (changedResult.status !== 0) {
      throw new Error(
        `git dependency delta check failed: ${changedResult.stderr}`,
      );
    }
    const changedManifests = changedResult.stdout
      .split(/\r?\n/u)
      .filter((path) => /(^|\/)package(?:-lock)?\.json$/u.test(path));
    const unreviewedManifests = changedManifests.filter(
      (path) => !Object.hasOwn(policy.reviewedDependencyFiles, path),
    );
    if (unreviewedManifests.length) {
      failures.push(
        `PR1 has unreviewed npm manifest changes:\n  ${unreviewedManifests.join("\n  ")}`,
      );
    }
  }
  checkNpmAudit("production", ["--omit=dev"], policy.npm.productionMaximum);
  checkNpmAudit("all", [], policy.npm.allMaximum);
}

function rustAuditResult() {
  const configured = process.env.CARGO_AUDIT_BIN;
  if (configured) return run(configured, ["audit", "--json"]);
  return run(executable("cargo"), ["audit", "--json"]);
}

function vulnerabilityKey(item) {
  return `${item.advisory.id}:${item.package.name}@${item.package.version}`;
}

function warningKeys(report) {
  return Object.entries(report.warnings ?? {}).flatMap(([kind, entries]) =>
    entries.map(
      (item) =>
        `${kind}:${item.package.name}@${item.package.version}:${item.advisory?.id ?? ""}`,
    ),
  );
}

function reportUnexpected(actual, allowed, label) {
  const allowedSet = new Set(allowed);
  const unexpected = [...new Set(actual)]
    .filter((key) => !allowedSet.has(key))
    .sort();
  if (unexpected.length)
    failures.push(`${label} introduced:\n  ${unexpected.join("\n  ")}`);
  const resolved = allowed.filter((key) => !new Set(actual).has(key));
  if (resolved.length)
    console.log(
      `${label} no longer present (${resolved.length}); prune on review.`,
    );
}

if (modes.has("rust")) {
  const report = parseJsonOutput(rustAuditResult(), "cargo audit");
  const vulnerabilities = (report.vulnerabilities?.list ?? []).map(
    vulnerabilityKey,
  );
  const warnings = warningKeys(report);
  reportUnexpected(
    vulnerabilities,
    policy.rust.vulnerabilities,
    "RustSec vulnerabilities",
  );
  reportUnexpected(
    warnings,
    policy.rust.warnings,
    "RustSec informational/yanked warnings",
  );
  console.log(
    `RustSec: ${vulnerabilities.length} inherited vulnerabilities, ${warnings.length} inherited warnings`,
  );
}

if (modes.has("licenses")) {
  const metadataResult = run(executable("cargo"), [
    "metadata",
    "--format-version",
    "1",
    "--features",
    "inference",
  ]);
  if (metadataResult.status !== 0) {
    throw new Error(`cargo metadata failed: ${metadataResult.stderr}`);
  }
  const metadata = parseJsonOutput(metadataResult, "cargo metadata");
  for (const expected of policy.introducedRustPackages) {
    const matches = metadata.packages.filter(
      (pkg) => pkg.name === expected.name && pkg.version === expected.version,
    );
    if (matches.length !== 1) {
      failures.push(
        `${expected.name}@${expected.version} expected exactly once; found ${matches.length}`,
      );
      continue;
    }
    const actual = matches[0];
    if (actual.license !== expected.license) {
      failures.push(
        `${expected.name}@${expected.version} license changed: ${actual.license} != ${expected.license}`,
      );
    }
    if (
      !actual.source?.startsWith(
        "registry+https://github.com/rust-lang/crates.io-index",
      )
    ) {
      failures.push(
        `${expected.name}@${expected.version} has unreviewed source ${actual.source}`,
      );
    }
  }
  const tauriConfig = JSON.parse(
    readFileSync(resolve(root, "frontend/src-tauri/tauri.conf.json"), "utf8"),
  );
  for (const notice of [
    "THIRD_PARTY_NOTICES.md",
    "THIRD_PARTY_LICENSES/Apache-2.0.txt",
    "THIRD_PARTY_LICENSES/MIT.txt",
  ]) {
    if (!tauriConfig.bundle?.resources?.includes(notice)) {
      failures.push(
        `Tauri bundle omits required third-party notice resource ${notice}`,
      );
    }
    if (!existsSync(resolve(root, "frontend/src-tauri", notice))) {
      failures.push(`Required third-party notice file is missing: ${notice}`);
    }
  }
  console.log(
    `Licenses: checked ${policy.introducedRustPackages.length} PR1 packages`,
  );
}

if (modes.has("sbom")) {
  const configuredOutput = process.env.SBOM_OUTPUT;
  if (!configuredOutput) {
    throw new Error("SBOM_OUTPUT must name a JSON file outside the repository");
  }
  const output = resolve(configuredOutput);
  const outputRelativeToRoot = relative(root, output);
  const outputIsInRoot =
    outputRelativeToRoot === "" ||
    (outputRelativeToRoot !== ".." &&
      !outputRelativeToRoot.startsWith(`..${sep}`) &&
      !isAbsolute(outputRelativeToRoot));
  if (outputIsInRoot) {
    throw new Error(
      `Refusing to write the SBOM inside the repository: ${output}`,
    );
  }
  if (!output.endsWith(".json")) {
    throw new Error(`SBOM_OUTPUT must end in .json: ${output}`);
  }

  const scratch = mkdtempSync(join(tmpdir(), "openchat-pr1-sbom-"));
  try {
    const pluginPath = resolve(root, "frontend/tauri-plugin-oc");
    writeFileSync(
      resolve(scratch, "Cargo.toml"),
      [
        "[package]",
        'name = "openchat-pr1-model-sbom"',
        'version = "0.0.0"',
        'edition = "2021"',
        "publish = false",
        "",
        "[dependencies]",
        `tauri-plugin-oc = { path = ${JSON.stringify(pluginPath)}, features = ["inference"] }`,
        "",
      ].join("\n"),
    );
    mkdirSync(resolve(scratch, "src"));
    writeFileSync(resolve(scratch, "src/main.rs"), "fn main() {}\n");
    copyFileSync(resolve(root, "Cargo.lock"), resolve(scratch, "Cargo.lock"));

    const configured = process.env.CARGO_CYCLONEDX_BIN;
    const command = configured ?? executable("cargo");
    const result = run(
      command,
      [
        "cyclonedx",
        "--manifest-path",
        resolve(scratch, "Cargo.toml"),
        "--format",
        "json",
        "--spec-version",
        "1.5",
        "--target",
        "all",
        "--license-strict",
        "--override-filename",
        "bom",
      ],
      scratch,
    );
    if (result.status !== 0) {
      throw new Error(
        `cargo cyclonedx failed (${result.status}):\n${result.stdout}\n${result.stderr}`,
      );
    }

    const generated = resolve(scratch, "bom.json");
    if (!existsSync(generated)) {
      throw new Error(
        `cargo cyclonedx did not create the expected isolated SBOM: ${generated}`,
      );
    }
    const bom = JSON.parse(readFileSync(generated, "utf8"));
    const sourcePaths = [
      [scratch, "openchat-sbom-source"],
      [root, "openchat-workspace"],
    ];
    const canonicalizeString = (input) => {
      let outputString = input;
      for (const [sourcePath, canonicalName] of sourcePaths) {
        const forwardPath = sourcePath.replaceAll(String.fromCharCode(92), "/");
        const canonicalUri = "file:///" + canonicalName;
        outputString = outputString
          .replaceAll("file:///" + forwardPath, canonicalUri)
          .replaceAll("file://" + forwardPath, canonicalUri)
          .replaceAll("file://" + sourcePath, canonicalUri)
          .replaceAll(sourcePath, "/" + canonicalName)
          .replaceAll(forwardPath, "/" + canonicalName);
      }
      return outputString;
    };
    const canonicalizePaths = (value) => {
      if (typeof value === "string") return canonicalizeString(value);
      if (Array.isArray(value)) return value.map(canonicalizePaths);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            canonicalizePaths(item),
          ]),
        );
      }
      return value;
    };
    const canonicalBom = canonicalizePaths(bom);
    const serializedBom = JSON.stringify(canonicalBom, null, 2) + "\n";
    for (const [sourcePath] of sourcePaths) {
      const forwardPath = sourcePath.replaceAll(String.fromCharCode(92), "/");
      if (
        serializedBom.includes(sourcePath) ||
        serializedBom.includes(forwardPath)
      ) {
        throw new Error(
          "Generated SBOM discloses a local source path: " + sourcePath,
        );
      }
    }
    for (const expected of policy.introducedRustPackages) {
      if (
        !(bom.components ?? []).some(
          (component) =>
            component.name === expected.name &&
            component.version === expected.version,
        )
      ) {
        throw new Error(
          `Generated SBOM omits reviewed component ${expected.name}@${expected.version}`,
        );
      }
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, serializedBom);
    console.log(
      `SBOM: wrote ${bom.components?.length ?? 0} components to ${output}`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(`\nPR1 security policy failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `PR1 security policy passed; baseline review expires ${policy.expiresOn}.`,
);
