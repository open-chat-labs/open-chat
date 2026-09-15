#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewedDependencyDigest } from "./security_dependency_hash.mjs";
import { securityModes } from "./security_mode_scope.mjs";
import { ownedSecurityRules } from "./security_owned_rules.mjs";

const modes = securityModes(process.argv.slice(2), "pr2");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ownedChecksOnly = [...modes].every((mode) => mode === "licenses");
const policy = ownedChecksOnly
  ? ownedSecurityRules("pr2")
  : JSON.parse(readFileSync(resolve(root, ".github/security/openchat-pr2-security-baseline.json"), "utf8"));
const failures = [];

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

function git(args) {
  return run(process.platform === "win32" ? "git.exe" : "git", [
    "-c",
    `safe.directory=${root.replaceAll("\\", "/")}`,
    ...args,
  ]);
}

function changedPaths() {
  const diff = git(["diff", "--name-only", policy.baseCommit, "--"]);
  if (diff.status !== 0) throw new Error(`dependency delta check failed: ${diff.stderr}`);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  if (untracked.status !== 0) throw new Error(`dependency untracked check failed: ${untracked.stderr}`);
  return [...new Set(`${diff.stdout}\n${untracked.stdout}`.split(/\r?\n/u).filter(Boolean))].sort();
}

function json(result, label) {
  if (!result.stdout.trim()) throw new Error(`${label} produced no JSON (exit ${result.status}): ${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}\n${result.stdout}`);
  }
}

const changed = ownedChecksOnly ? [] : changedPaths();
for (const [path, expected] of Object.entries(ownedChecksOnly ? {} : policy.reviewedDependencyFiles)) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`Reviewed dependency file is missing: ${path}`);
    continue;
  }
  const actual = reviewedDependencyDigest(readFileSync(absolute), policy, path);
  if (actual !== expected) failures.push(`Reviewed dependency file changed: ${path} (${actual} != ${expected})`);
}
const reviewedDependencyFiles = new Set(Object.keys(ownedChecksOnly ? {} : policy.reviewedDependencyFiles));
const unreviewedCargoManifests = changed.filter(
  (path) => (path === "Cargo.toml" || path.endsWith("/Cargo.toml")) && !reviewedDependencyFiles.has(path),
);
if (unreviewedCargoManifests.length) {
  failures.push(`PR2 has unreviewed Cargo manifests:\n  ${unreviewedCargoManifests.join("\n  ")}`);
}
if (!ownedChecksOnly && new Date().toISOString().slice(0, 10) > policy.expiresOn) {
  failures.push(`Security baseline expired on ${policy.expiresOn}; re-audit PR2 dependencies`);
}

function changedNpmManifests() {
  return changed
    .filter((path) => path.startsWith("frontend/"))
    .filter((path) => /(^|\/)package(?:-lock)?\.json$/u.test(path))
    .sort();
}

function npmAudit(label, args, maximum) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm", "audit", "--json", ...args] : ["audit", "--json", ...args];
  const report = json(run(command, commandArgs, resolve(root, "frontend")), `npm audit (${label})`);
  const actual = report.metadata?.vulnerabilities;
  if (!actual) throw new Error(`npm audit (${label}) omitted vulnerability metadata`);
  for (const key of ["info", "low", "moderate", "high", "critical", "total"]) {
    if (actual[key] > maximum[key]) failures.push(`npm ${label} ${key} increased: ${actual[key]} > ${maximum[key]}`);
  }
  console.log(`npm ${label}: ${JSON.stringify(actual)}`);
}

function lockTuples(text) {
  return new Set(text.split("[[package]]").slice(1).flatMap((block) => {
    const name = block.match(/^name = "([^"]+)"/mu)?.[1];
    const version = block.match(/^version = "([^"]+)"/mu)?.[1];
    const source = block.match(/^source = "([^"]+)"/mu)?.[1];
    return name && version && source ? [`${name}@${version}:${source}`] : [];
  }));
}

function exactSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const added = [...actualSet].filter((item) => !expectedSet.has(item)).sort();
  const removed = [...expectedSet].filter((item) => !actualSet.has(item)).sort();
  if (added.length) failures.push(`${label} introduced:\n  ${added.join("\n  ")}`);
  if (removed.length) failures.push(`${label} changed/resolved; re-review baseline:\n  ${removed.join("\n  ")}`);
}

if (modes.has("ci")) {
  const workflow = readFileSync(resolve(root, ".github/workflows/openchat_pr2_security.yaml"), "utf8");
  const dependabot = readFileSync(resolve(root, ".github/dependabot.yml"), "utf8");
  const pins = [...workflow.matchAll(/node-version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)/gu)].map((match) => match[1]);
  if (pins.length !== 1 || pins[0] !== policy.ciRuntime.nodeVersion) failures.push(`Workflow must pin Node ${policy.ciRuntime.nodeVersion} exactly once`);
  if (Number(policy.ciRuntime.nodeVersion.split(".")[0]) !== 24) failures.push("PR2 workflow must stay on supported Node 24.x");
  if (process.env.CI === "true" && process.versions.node !== policy.ciRuntime.nodeVersion) failures.push(`CI is running Node ${process.versions.node}; expected ${policy.ciRuntime.nodeVersion}`);
  if (!workflow.includes(`cargo install cargo-audit --locked --version ${policy.ciRuntime.cargoAuditVersion}`)) failures.push("Workflow cargo-audit pin changed");
  for (const required of ["npm ci", "check_openchat_pr2_security.mjs ci npm", "check_openchat_pr2_security.mjs rust licenses", ".github/dependabot.yml"]) {
    if (!workflow.includes(required)) failures.push(`Workflow is missing: ${required}`);
  }
  for (const [ecosystem, directory, interval] of [
    ["npm", "/frontend", "daily"],
    ["cargo", "/", "daily"],
    ["github-actions", "/", "weekly"],
  ]) {
    const start = dependabot.indexOf(`package-ecosystem: "${ecosystem}"`);
    const end = dependabot.indexOf("package-ecosystem:", start + 1);
    const block = start < 0 ? "" : dependabot.slice(start, end < 0 ? undefined : end);
    if (!block.includes(`directory: "${directory}"`) || !block.includes(`interval: "${interval}"`)) failures.push(`Dependabot ${ecosystem} must cover ${directory} on the ${interval} schedule`);
  }
  console.log(`CI: Node ${policy.ciRuntime.nodeVersion}, cargo-audit ${policy.ciRuntime.cargoAuditVersion}, Dependabot checked`);
}

if (modes.has("npm")) {
  const changed = changedNpmManifests();
  if (changed.length) failures.push(`PR2 has npm manifest/lock delta:\n  ${changed.join("\n  ")}`);
  npmAudit("production", ["--omit=dev"], policy.npm.productionMaximum);
  npmAudit("all", [], policy.npm.allMaximum);
}

if (modes.has("rust")) {
  const version = run(process.env.CARGO_AUDIT_BIN ?? (process.platform === "win32" ? "cargo.exe" : "cargo"), process.env.CARGO_AUDIT_BIN ? ["--version"] : ["audit", "--version"]);
  if (!version.stdout.includes(policy.ciRuntime.cargoAuditVersion)) failures.push(`cargo-audit must be ${policy.ciRuntime.cargoAuditVersion}: ${version.stdout.trim()}`);
  const audit = json(run(process.env.CARGO_AUDIT_BIN ?? (process.platform === "win32" ? "cargo.exe" : "cargo"), process.env.CARGO_AUDIT_BIN ? ["audit", "--json"] : ["audit", "--json"]), "cargo audit");
  exactSet((audit.vulnerabilities?.list ?? []).map((item) => `${item.advisory.id}:${item.package.name}@${item.package.version}`), policy.rust.vulnerabilities, "RustSec vulnerabilities");
  exactSet(Object.entries(audit.warnings ?? {}).flatMap(([kind, entries]) => entries.map((item) => `${kind}:${item.package.name}@${item.package.version}:${item.advisory?.id ?? ""}`)), policy.rust.warnings, "RustSec warnings");

  const baseLock = git(["show", `${policy.baseCommit}:Cargo.lock`]);
  if (baseLock.status !== 0) throw new Error(`cannot read base Cargo.lock: ${baseLock.stderr}`);
  const current = lockTuples(readFileSync(resolve(root, "Cargo.lock"), "utf8"));
  const base = lockTuples(baseLock.stdout);
  const introduced = [...current].filter((item) => !base.has(item)).sort();
  const removed = [...base].filter((item) => !current.has(item)).sort();
  exactSet(introduced, policy.rust.externalLockDelta.introduced, "PR2-introduced external Cargo tuples");
  exactSet(removed, policy.rust.externalLockDelta.removed, "PR2-removed external Cargo tuples");
  console.log(
    `RustSec: exact ${policy.rust.vulnerabilities.length} vulnerabilities / ${policy.rust.warnings.length} warnings; external lock delta ${introduced.length} introduced / ${removed.length} removed`,
  );
}

if (modes.has("licenses")) {
  const metadataResult = run(process.platform === "win32" ? "cargo.exe" : "cargo", ["metadata", "--locked", "--offline", "--format-version", "1"]);
  if (metadataResult.status !== 0) throw new Error(`cargo metadata failed: ${metadataResult.stderr}`);
  const metadata = json(
    metadataResult,
    "cargo metadata",
  );
  for (const expected of policy.directRustPackages) {
    const matches = metadata.packages.filter((pkg) => pkg.name === expected.name && pkg.version === expected.version);
    if (matches.length !== 1) {
      failures.push(`${expected.name}@${expected.version} expected once; found ${matches.length}`);
      continue;
    }
    const actual = matches[0];
    if (actual.license !== expected.license || actual.source !== expected.source) failures.push(`${expected.name}@${expected.version} license/source changed: ${actual.license} / ${actual.source}`);
    if (!readFileSync(resolve(root, expected.manifest), "utf8").includes(`${expected.name} = { workspace = true }`)) failures.push(`${expected.name} is not a direct reviewed dependency of ${expected.manifest}`);
  }
  for (const expected of policy.workspaceOnlyPackages) {
    const pkg = metadata.packages.find((candidate) => candidate.name === expected.name);
    if (!pkg || pkg.source !== null || resolve(pkg.manifest_path) !== resolve(root, expected.manifest)) failures.push(`${expected.name} must remain a path-only workspace test package`);
  }
  console.log(`Licenses/source: ${policy.directRustPackages.length} direct packages and ${policy.workspaceOnlyPackages.length} workspace-only fixture checked`);
}

if (failures.length) {
  console.error(`\nPR2 security policy failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(ownedChecksOnly
  ? "PR2 offline owned checks passed (licenses); advisory and release acceptance not assessed."
  : `PR2 security policy passed; baseline expires ${policy.expiresOn}.`);
