import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FEATURE_CI_NODE_VERSION = "24.18.1";
export const NPM_FEATURE_CI_TEST_COMMAND =
  "node --test scripts/npm_feature_scope.test.mjs scripts/npm_feature_seed_review.test.mjs scripts/npm_feature_advisories.test.mjs scripts/npm_feature_advisories.review.test.mjs scripts/npm_feature_runtime.test.mjs scripts/check_feature_ci.test.mjs scripts/security_mode_scope.test.mjs scripts/security_owned_rules.test.mjs";
export const npmFeatureQueryCommand = (scope) => {
  assert(["pr1", "pr2"].includes(scope), "Explicit npm feature scope required");
  return [
    "set -euo pipefail",
    'npm_root="$(npm root --global)"',
    `node scripts/npm_feature_advisories.mjs --repository-root "$GITHUB_WORKSPACE" --scope ${scope} --arborist-path "$npm_root/npm/node_modules/@npmcli/arborist" --output-directory "$RUNNER_TEMP" --mode query-bulk`,
  ].join("\n");
};
export const npmFeatureSmokeCommand = (scope) =>
  npmFeatureQueryCommand(scope)
    .replace(
      "scripts/npm_feature_advisories.mjs",
      "scripts/npm_feature_runtime_smoke.mjs",
    )
    .replace("--mode query-bulk", "--mode plan");
export const OFFLINE_FEATURE_HELPER_TESTS = Object.freeze([
  "scripts/npm_feature_scope.test.mjs",
  "scripts/npm_feature_seed_review.test.mjs",
  "scripts/npm_feature_advisories.test.mjs",
  "scripts/npm_feature_advisories.review.test.mjs",
  "scripts/npm_feature_runtime.test.mjs",
  "scripts/rust_feature_scope.test.mjs",
  "scripts/rust_feature_seed_review.test.mjs",
  "scripts/rust_feature_advisories.test.mjs",
  "scripts/rust_feature_advisory_results.test.mjs",
  "scripts/rust_feature_advisory_runner.test.mjs",
  "scripts/rust_feature_sbom.test.mjs",
  "scripts/rust_feature_sbom_validate.test.mjs",
  "scripts/rust_feature_collection.test.mjs",
  "scripts/rust_feature_ci.test.mjs",
  "scripts/check_feature_ci.test.mjs",
  "scripts/security_mode_scope.test.mjs",
  "scripts/security_owned_rules.test.mjs",
]);
const root = fileURLToPath(new URL("../", import.meta.url));

// Deliberately supports the repository's literal YAML layout, not arbitrary YAML execution.
function block(text, key, indentation) {
  const matches = [
    ...text.matchAll(new RegExp(`^ {${indentation}}${key}:[ \\t]*$`, "gmu")),
  ];
  assert.equal(matches.length, 1, `Expected one ${key} mapping`);
  const rest = text.slice(matches[0].index + matches[0][0].length);
  const end = rest.search(new RegExp(`^ {0,${indentation}}\\S`, "mu"));
  return end < 0 ? rest : rest.slice(0, end);
}

function jobs(text) {
  const value = block(text, "jobs", 0);
  return new Map(
    [...value.matchAll(/^ {2}([a-z0-9-]+):[ \t]*$/gmu)].map(([, name]) => {
      const body = block(value, name, 2);
      assert.doesNotMatch(
        body,
        /^ {4}(?:if|continue-on-error):/mu,
        `Conditional/ignored feature job ${name}`,
      );
      return [name, body];
    }),
  );
}

function steps(job) {
  return block(job, "steps", 4)
    .split(/^ {6}- /mu)
    .slice(1);
}

function runs(step) {
  return [...step.matchAll(/^(?:run:| {8}run:) ([^\n]*)$/gmu)].map((match) => {
    const first = match[1];
    if (!/^[|>][-+]?$/u.test(first)) return first;
    const tail = step
      .slice(match.index + match[0].length)
      .split("\n")
      .slice(1);
    const lines = [];
    for (const line of tail) {
      if (line.trim() && !/^ {10}/u.test(line)) break;
      if (line.trim() && !line.trimStart().startsWith("#"))
        lines.push(line.slice(10));
    }
    return lines.join(first.startsWith(">") ? " " : "\n");
  });
}

function commands(job) {
  return steps(job).flatMap((step) =>
    runs(step).map((command) => ({ step, command })),
  );
}

function requiredCommand(job, predicate, label) {
  const matches = commands(job).filter(({ command }) => predicate(command));
  assert.equal(matches.length, 1, `Expected one executable ${label}`);
  assert.doesNotMatch(
    matches[0].step,
    /^(?:if:|continue-on-error:| {8}(?:if|continue-on-error):)/mu,
    `Conditional/ignored ${label}`,
  );
  assert.doesNotMatch(
    matches[0].command,
    /\|\|\s*true|;\s*(?:true|exit 0)\b/u,
    `Suppressed failure: ${label}`,
  );
  return matches[0].command;
}

export const RUST_FEATURE_FETCH_COMMAND = [
  "set -euo pipefail",
  "rustup toolchain install 1.95.0 --profile minimal",
  'cargo_path="$(rustup which --toolchain 1.95.0 cargo)"',
  'rustc_path="$(rustup which --toolchain 1.95.0 rustc)"',
  'RUSTC="$rustc_path" "$cargo_path" fetch --locked',
].join("\n");
export const rustFeatureCiCommand = (scope) => {
  assert(
    ["pr1", "pr2"].includes(scope),
    "Explicit Rust feature scope required",
  );
  return [
    "set -euo pipefail",
    'cargo_path="$(rustup which --toolchain 1.95.0 cargo)"',
    `config_sha256="$(sha256sum scripts/rust_feature_scope.${scope}.json)"`,
    'config_sha256="${config_sha256%% *}"',
    `node scripts/rust_feature_ci.mjs --repository-root "$GITHUB_WORKSPACE" --scope ${scope} --config-sha256 "$config_sha256" --output-directory "$RUNNER_TEMP" --cargo-executable "$cargo_path" --mode check-scoped`,
  ].join("\n");
};
export const RUST_FEATURE_REPORT_PATHS = Object.freeze([
  "rust-feature-ci-*/summary.json",
  "rust-feature-ci-*/rust-feature-collection-*/summary.json",
  "rust-feature-ci-*/rust-feature-collection-*/collection.json",
  "rust-feature-ci-*/rust-feature-collection-*/*.selected.json",
  "rust-feature-ci-*/rust-feature-collection-*/selected-rust.cdx*.json",
  "rust-feature-ci-*/rust-feature-advisories-*/*",
]);

export function checkRustFeatureCi({ slice, workflows }) {
  assert(["pr1", "pr2"].includes(slice), "Explicit Rust CI slice required");
  // PR1 checks the model-only slice; PR2's security workflow checks its additive
  // app/card slice plus the explicitly rebound local WebGPU composition. Do not
  // pretend PR2 contains PR1's absent config or qualify all inherited profiles.
  const key = slice === "pr1" ? "model" : "security";
  const jobName = slice === "pr1" ? "dependency-policy" : "dependency-security";
  for (const workflowKey of [
    "model",
    ...(slice === "pr2" ? ["security"] : []),
  ]) {
    const text = workflows[workflowKey].replaceAll("\r\n", "\n");
    const inventory = jobs(text);
    const job = inventory.get(
      workflowKey === "model" ? "dependency-policy" : "dependency-security",
    );
    const fetch = requiredCommand(
      job,
      (command) => command.includes("fetch --locked"),
      "explicit locked Rust input preparation",
    );
    assert.equal(fetch, RUST_FEATURE_FETCH_COMMAND);
    const fetchStep = commands(job).find((item) => item.command === fetch).step;
    assert.match(
      fetchStep,
      /^ {8}working-directory: \.[ \t]*$/mu,
      "Rust preparation must use the selected checkout",
    );
    assert.doesNotMatch(
      fetchStep,
      /^(?:shell:| {8}shell:)/mu,
      "Rust preparation shell override",
    );
    assert.doesNotMatch(
      text,
      /cargo install cargo-(?:audit|cyclonedx)/u,
      "Obsolete whole-workspace audit/SBOM tool installation remains",
    );
  }
  const job = jobs(workflows[key].replaceAll("\r\n", "\n")).get(jobName);
  const matched = commands(job).filter(({ command }) =>
    command.includes("scripts/rust_feature_ci.mjs"),
  );
  assert.equal(
    matched.length,
    1,
    "One executable scoped Rust gate is required",
  );
  const command = requiredCommand(
    job,
    (value) => value.includes("scripts/rust_feature_ci.mjs"),
    "scoped Rust CI gate",
  );
  assert.equal(
    command,
    rustFeatureCiCommand(slice),
    "Exact scoped Rust gate required",
  );
  assert.match(
    matched[0].step,
    /^ {8}working-directory: \.[ \t]*$/mu,
    "Rust CI must use the selected checkout",
  );
  assert.doesNotMatch(
    matched[0].step,
    /^(?:shell:| {8}shell:)/mu,
    "Rust CI shell override",
  );
  const sequence = commands(job).map((item) => item.command);
  requiredCommand(
    job,
    (value) => value === `node scripts/check_feature_ci.mjs ${slice}`,
    "full scoped workflow check",
  );
  const license = `node scripts/check_openchat_${slice}_security.mjs licenses`;
  assert(
    sequence.indexOf(RUST_FEATURE_FETCH_COMMAND) < sequence.indexOf(license) &&
      sequence.indexOf(license) < sequence.indexOf(command),
    "Locked input preparation and offline license gate must precede Rust CI",
  );
  const uploads = steps(job).filter((step) =>
    step.includes(`name: openchat-${slice}-scoped-rust-report`),
  );
  assert.equal(uploads.length, 1, "Scoped Rust evidence upload required");
  const upload = uploads[0];
  assert.match(upload, /^ {8}if: always\(\)$/mu);
  assert.match(
    upload,
    /^ {8}uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02(?: #.*)?$/mu,
  );
  assert.match(upload, /^ {10}if-no-files-found: error$/mu);
  assert.match(
    upload,
    /^ {10}path: \|$/mu,
    "Executable Rust report path required",
  );
  assert.doesNotMatch(
    upload,
    /^(?:continue-on-error:| {8}continue-on-error:)/mu,
    "Rust report upload failure cannot be ignored",
  );
  const paths = [
    ...upload.matchAll(/^ {12}\$\{\{ runner\.temp \}\}\/([^\n]+)$/gmu),
  ].map((match) => match[1]);
  assert.deepEqual(
    paths,
    [...RUST_FEATURE_REPORT_PATHS],
    "Upload selected evidence only; omit raw workspace metadata",
  );
  return {
    pass: true,
    slice,
    advisoryAcceptance: false,
    releaseAcceptance: false,
  };
}

/** Npm-only structural contract; Rust/SBOM and release acceptance are separate. */
export function checkNpmFeatureCi({
  slice,
  workflows,
  runtime = process.versions.node,
  ci = false,
}) {
  assert(["pr1", "pr2"].includes(slice), "Explicit npm CI slice required");
  if (ci) assert.equal(runtime, FEATURE_CI_NODE_VERSION, "CI Node runtime pin");
  const selections = [
    ["model", "dependency-policy", "pr1"],
    ...(slice === "pr2" ? [["security", "dependency-security", "pr2"]] : []),
  ];
  for (const [key, jobName, scope] of selections) {
    const text = workflows[key].replaceAll("\r\n", "\n");
    const job = jobs(text).get(jobName);
    assert(job, "Missing scoped dependency job: " + jobName);
    for (const [source, indentation] of [
      [text, 0],
      [job, 4],
    ]) {
      if (new RegExp(`^ {${indentation}}defaults:`, "mu").test(source)) {
        assert.doesNotMatch(
          block(source, "defaults", indentation),
          /\bshell:|\bworking-directory:/u,
          "Inherited npm gate execution override",
        );
      }
    }
    const node = steps(job).filter((step) =>
      /^(?:uses:| {8}uses:) actions\/setup-node@/mu.test(step),
    );
    assert.equal(node.length, 1, "One pinned Node setup required");
    assert.doesNotMatch(
      node[0],
      /^(?:if:|continue-on-error:| {8}(?:if|continue-on-error):)/mu,
      "Node setup must execute",
    );
    assert.match(
      node[0],
      new RegExp(
        `^ {10}node-version: "${FEATURE_CI_NODE_VERSION.replaceAll(".", "\\.")}"$`,
        "mu",
      ),
      "Pinned Node version required",
    );
    const required = [
      ["npm ci --no-audit", "frontend"],
      [NPM_FEATURE_CI_TEST_COMMAND, "."],
      [`node scripts/check_feature_ci.mjs npm-${scope}`, "."],
      [npmFeatureSmokeCommand(scope), "."],
      [npmFeatureQueryCommand(scope), "."],
      [`node scripts/check_openchat_${scope}_security.mjs licenses`, "."],
    ];
    for (const [expected, directory] of required) {
      requiredCommand(
        job,
        (command) => command === expected,
        "scoped npm/license command " + expected,
      );
      const step = steps(job).find((candidate) =>
        runs(candidate).includes(expected),
      );
      assert.deepEqual(
        [...step.matchAll(/^ {8}working-directory: (.+)$/gmu)].map(
          (match) => match[1],
        ),
        [directory],
        "Explicit gate working directory required",
      );
      assert.doesNotMatch(
        step,
        /^(?:shell:| {8}shell:)/mu,
        "No gate shell override",
      );
      if (
        [npmFeatureQueryCommand(scope), npmFeatureSmokeCommand(scope)].includes(
          expected,
        )
      )
        assert.match(
          step,
          /^ {8}run: \|$/mu,
          "Scoped collector requires literal Bash block",
        );
      else
        assert.match(
          step,
          /^ {8}run: [^|>\n][^\n]*$/mu,
          "Gate requires literal single-line command",
        );
    }
    const execution = commands(job).map((item) => item.command);
    assert(
      execution.indexOf("npm ci --no-audit") <
        execution.indexOf(npmFeatureSmokeCommand(scope)) &&
        execution.indexOf(npmFeatureSmokeCommand(scope)) <
          execution.indexOf(npmFeatureQueryCommand(scope)),
      "Real offline runtime smoke must run after installation and before any advisory query",
    );
    assert.doesNotMatch(
      job,
      /\bnpm\s+audit\b|check_openchat_pr[12]_security\.mjs ci npm/u,
      "Broad npm audit remains",
    );
    const uploads = steps(job).filter((step) =>
      step.includes(`name: openchat-${scope}-scoped-npm-report`),
    );
    assert.equal(uploads.length, 1, "One scoped npm report upload required");
    assert.match(
      uploads[0],
      /^(?:uses:| {8}uses:) actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02(?: # v4)?$/mu,
    );
    assert.match(
      uploads[0],
      /^ {8}if: always\(\)$/mu,
      "Retain failure diagnostics",
    );
    assert.doesNotMatch(uploads[0], /\bcontinue-on-error:/u);
    assert.match(
      uploads[0],
      /^ {10}path: \$\{\{ runner\.temp \}\}\/npm-feature-advisories-\*$/mu,
      "Only scoped reports may be uploaded",
    );
    assert.match(uploads[0], /^ {10}if-no-files-found: error$/mu);
    if (key === "security") {
      requireRoutes(
        text,
        {
          pull_request: ["master", "codex/pr1-local-models"],
          push: [
            "codex/pr2-app-chat-interfaces",
            "codex/pr2-clean-integration",
          ],
        },
        true,
      );
    } else {
      assert(
        text.includes('"scripts/npm_feature*"'),
        "Npm ownership/runner route missing",
      );
      assert(
        text.includes('"scripts/rust_feature*"'),
        "Rust scope/runner route missing",
      );
      assert(
        text.includes('"scripts/vendor/cyclonedx-1.6/**"'),
        "Pinned Rust SBOM schema route missing",
      );
      assert(
        text.includes('"scripts/check_feature_ci*"'),
        "Npm workflow contract route missing",
      );
      assert(text.includes('"frontend/.npmrc"'), "Install-mode route missing");
    }
  }
  return {
    pass: true,
    slice,
    mode: "partial-npm-feature-ci-contract",
    runtimeChecked: ci,
    advisoryAcceptance: false,
    rustSbomAcceptance: false,
  };
}

function checkNodeAndInstalls(text, expectedNodeJobs, expectedInstallJobs) {
  const inventory = jobs(text);
  const nodeJobs = [];
  const installJobs = [];
  for (const [name, job] of inventory) {
    for (const step of steps(job)) {
      if (/^(?:uses:| {8}uses:) actions\/setup-node@/mu.test(step)) {
        assert.doesNotMatch(
          step,
          /^(?:if:| {8}if:)/mu,
          `Conditional Node setup: ${name}`,
        );
        assert.deepEqual(
          [
            ...step.matchAll(/^ {10}node-version: ["']([^"']+)["'][ \t]*$/gmu),
          ].map((match) => match[1]),
          [FEATURE_CI_NODE_VERSION],
          `Node setup: ${name}`,
        );
        nodeJobs.push(name);
      }
      for (const command of runs(step)) {
        assert.doesNotMatch(
          command,
          /\bnpm\s+audit\b|\bcargo\s+audit\b|check_openchat_pr[12]_security\.mjs[^\n]*(?:\bnpm\b|\brust\b|\bsbom\b)/u,
          `Legacy whole-lockfile command remains: ${name}`,
        );
        if (!/\bnpm\s+(?:ci|install|i)\b/u.test(command)) continue;
        assert.equal(
          command,
          "npm ci --no-audit",
          `Audit-free exact install: ${name}`,
        );
        assert.doesNotMatch(
          step,
          /^(?:if:|continue-on-error:| {8}(?:if|continue-on-error):)/mu,
          `Conditional/ignored install: ${name}`,
        );
        installJobs.push(name);
      }
    }
  }
  assert.deepEqual(
    nodeJobs.sort(),
    [...expectedNodeJobs].sort(),
    "Node setup job coverage",
  );
  assert.deepEqual(
    installJobs.sort(),
    [...expectedInstallJobs].sort(),
    "Exact install job coverage",
  );
  assert.equal(
    [...text.matchAll(/^ +node-version:/gmu)].length,
    nodeJobs.length,
    "Unowned Node pin",
  );
  return inventory;
}

function requireRoutes(text, required, unfiltered = false) {
  const events = block(text, "on", 0);
  assert.match(
    events,
    /^ {2}workflow_dispatch:[ \t]*$/mu,
    "Manual rerun route missing",
  );
  for (const [event, requiredBranches] of Object.entries(required)) {
    const route = block(events, event, 2);
    if (unfiltered) {
      assert.deepEqual(
        [...route.matchAll(/^ {4}([a-z_-]+):/gmu)].map((match) => match[1]),
        ["branches"],
        `Feature route must not be path/type filtered: ${event}`,
      );
    }
    const inline = /^ {4}branches: \[([^\]]+)\][ \t]*$/mu.exec(route);
    const body = inline ? undefined : block(route, "branches", 4).trim();
    const flow = body?.startsWith("[")
      ? /^\[([\s\S]*)\]$/u.exec(body)
      : undefined;
    assert(
      !body?.startsWith("[") || flow,
      "Unsupported multiline branch selector",
    );
    const values =
      inline || flow
        ? (inline ?? flow)[1]
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : block(route, "branches", 4)
            .split("\n")
            .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
            .map((line) => {
              const match = /^ {6}- ([a-z0-9/_-]+)[ \t]*$/u.exec(line);
              assert(match, "Unsupported branch selector");
              return match[1];
            });
    for (const branch of values)
      assert.match(branch, /^[a-z0-9/_-]+$/u, "Unsupported branch selector");
    for (const branch of requiredBranches)
      assert(values.includes(branch), `Missing ${event} route: ${branch}`);
  }
}

/** Validate the real offline test step independently of unresolved advisory workflow gates. */
export function checkOfflineFeatureHelpers(frontendText) {
  frontendText = frontendText.replaceAll("\r\n", "\n");
  const frontend = jobs(frontendText).get("install-and-test");
  assert(frontend, "Missing frontend job");
  for (const [text, indentation] of [
    [frontendText, 0],
    [frontend, 4],
  ]) {
    if (new RegExp("^ {" + indentation + "}defaults:", "mu").test(text)) {
      const defaults = block(text, "defaults", indentation);
      assert.doesNotMatch(
        defaults,
        /\bshell:/u,
        "Do not override inherited helper test failure handling",
      );
    }
  }
  const expected = "node --test " + OFFLINE_FEATURE_HELPER_TESTS.join(" ");
  requiredCommand(
    frontend,
    (value) => value === expected,
    "offline feature helper tests",
  );
  const step = steps(frontend).find((value) => runs(value).includes(expected));
  // Do not reconstruct shell commands from YAML scalars: folding can turn a
  // comment plus a command into one comment that successfully executes nothing.
  assert.deepEqual(
    [...step.matchAll(/^ {8}run: ([^\n]+)$/gmu)].map((match) => match[1]),
    [expected],
    "Offline helper tests require one literal single-line run field",
  );
  assert.deepEqual(
    [...step.matchAll(/^ {8}working-directory: (.+)$/gmu)].map(
      (match) => match[1],
    ),
    ["."],
    "Offline helper tests must run from repository root",
  );
  assert.doesNotMatch(
    step,
    /^(?:shell:| {8}shell:)/mu,
    "Do not override helper test failure handling",
  );
  return [...OFFLINE_FEATURE_HELPER_TESTS];
}

/** Offline CI structure/coverage contract only; no baseline, dependency graph, advisory or build execution. */
export function checkFeatureCi({
  slice,
  workflows,
  runtime = process.versions.node,
  ci = false,
}) {
  assert(
    ["pr1", "pr2"].includes(slice),
    "Select explicit pr1 or pr2 feature scope",
  );
  if (ci)
    assert.equal(
      runtime,
      FEATURE_CI_NODE_VERSION,
      "CI runtime differs from supported exact pin",
    );
  const expectedKeys =
    slice === "pr1"
      ? ["frontend", "model"]
      : ["frontend", "integration", "model", "security"];
  assert.deepEqual(
    Object.keys(workflows).sort(),
    expectedKeys,
    "Missing/extra feature workflows",
  );
  const normalized = Object.fromEntries(
    Object.entries(workflows).map(([key, text]) => {
      assert.equal(typeof text, "string");
      assert(
        text.length > 0 && text.length < 100_000,
        "Missing/oversized workflow",
      );
      return [key, text.replaceAll("\r\n", "\n")];
    }),
  );
  checkNpmFeatureCi({ slice, workflows: normalized, runtime, ci });
  checkRustFeatureCi({ slice, workflows: normalized });
  const modelJobs = checkNodeAndInstalls(
    normalized.model,
    ["dependency-policy", "android-component-contracts", "frontend-contracts"],
    ["dependency-policy", "frontend-contracts"],
  );
  for (const name of [
    "dependency-policy",
    "android-component-contracts",
    "native-hermetic",
    "frontend-contracts",
    "real-text-inference",
  ])
    assert(modelJobs.has(name), `Missing model feature job: ${name}`);
  requireRoutes(normalized.model, {
    pull_request: ["master"],
    push: ["codex/pr1-local-models"],
  });
  const modelTests = requiredCommand(
    modelJobs.get("frontend-contracts"),
    (value) => value.startsWith("npm test -- "),
    "model frontend contracts",
  );
  for (const selection of [
    "app/src/utils/model",
    "app/src/utils/transformersWebGpu",
    "app/src/utils/webGpuModelCatalog",
    "app/src/utils/gemma4WebGpu",
    "app/src/utils/localAudioInput",
    "app/src/utils/onDeviceInference",
    "app/src/utils/nativeInferenceRuntimeBridge",
    "app/src/stores/onDeviceModels",
    "app/src/components_shared/WebInferenceRuntimeSettings",
    "app/src/components_shared/WebGpuModelCatalog",
  ])
    assert(
      modelTests.split(/\s+/u).includes(selection),
      `Missing model test family: ${selection}`,
    );
  requiredCommand(
    modelJobs.get("android-component-contracts"),
    (value) => value.includes("component-identity-tests/run.ps1"),
    "Android component contracts",
  );
  requiredCommand(
    modelJobs.get("native-hermetic"),
    (value) => value === "cargo test --locked -p tauri-plugin-oc --lib",
    "native model library contracts",
  );
  const real = requiredCommand(
    modelJobs.get("real-text-inference"),
    (value) => value.includes("inference::tests::text_inference_smoke"),
    "real text inference fixture",
  );
  assert.match(
    real,
    /^cargo test --locked -p tauri-plugin-oc --features inference /u,
  );
  assert.match(real, /--ignored --exact --nocapture$/u);

  const frontendJobs = checkNodeAndInstalls(
    normalized.frontend,
    ["install-and-test"],
    ["install-and-test"],
  );
  requireRoutes(
    normalized.frontend,
    {
      pull_request:
        slice === "pr1" ? ["master"] : ["master", "codex/pr1-local-models"],
      push:
        slice === "pr1"
          ? ["codex/pr1-local-models"]
          : [
              "codex/pr1-local-models",
              "codex/pr2-app-chat-interfaces",
              "codex/pr2-clean-integration",
            ],
    },
    true,
  );
  const frontend = frontendJobs.get("install-and-test");
  checkOfflineFeatureHelpers(normalized.frontend);
  requiredCommand(
    frontend,
    (value) => value === "npm run build:ci",
    "frontend build contracts",
  );
  const helperTests = requiredCommand(
    frontend,
    (value) =>
      value.startsWith("node --test ") &&
      value.includes("scripts/model_ci_coverage.test.mjs"),
    "model coverage regressions",
  );
  assert(
    helperTests.includes("scripts/security_mode_scope.test.mjs"),
    "Legacy safety guard tests missing",
  );

  if (slice === "pr2") {
    checkNodeAndInstalls(
      normalized.security,
      ["dependency-security"],
      ["dependency-security"],
    );
    requireRoutes(normalized.security, {
      pull_request: ["master", "codex/pr1-local-models"],
      push: ["codex/pr2-app-chat-interfaces", "codex/pr2-clean-integration"],
    });
    const integrationJobs = checkNodeAndInstalls(
      normalized.integration,
      ["app-model-integration"],
      [],
    );
    requireRoutes(
      normalized.integration,
      {
        pull_request: ["codex/pr1-local-models"],
        push: ["codex/pr2-app-chat-interfaces", "codex/pr2-clean-integration"],
      },
      true,
    );
    const integration = integrationJobs.get("app-model-integration");
    requiredCommand(
      integration,
      (value) => value === "node --test scripts/app_model_integration.test.mjs",
      "scoped integration selector tests",
    );
    requiredCommand(
      integration,
      (value) =>
        value.startsWith(
          "cargo test --locked --package integration_tests --no-run --message-format=json ",
        ),
      "locked integration fixture link",
    );
    requiredCommand(
      integration,
      (value) =>
        value ===
        'node scripts/app_model_integration.mjs run "$RUNNER_TEMP/openchat-app-model-integration"',
      "scoped app/model integration execution",
    );
  }
  return {
    pass: true,
    slice,
    mode: "offline-feature-ci-contract",
    nodeVersion: FEATURE_CI_NODE_VERSION,
    runtimeChecked: ci,
    advisoryAcceptance: false,
    buildExecuted: false,
  };
}

export function readFeatureWorkflows(repositoryRoot, slice) {
  assert(
    ["pr1", "pr2"].includes(slice),
    "Select explicit pr1 or pr2 feature scope",
  );
  const files = {
    model: "on_device_model_security.yaml",
    frontend: "frontend.yaml",
    ...(slice === "pr2"
      ? {
          security: "openchat_pr2_security.yaml",
          integration: "app_model_integration.yaml",
        }
      : {}),
  };
  return Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      readFileSync(resolve(repositoryRoot, ".github/workflows", file), "utf8"),
    ]),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    3,
    "Usage: node scripts/check_feature_ci.mjs pr1|pr2|npm-pr1|npm-pr2",
  );
  const npmOnly = process.argv[2].startsWith("npm-");
  const slice = npmOnly ? process.argv[2].slice(4) : process.argv[2];
  console.log(
    JSON.stringify(
      (npmOnly ? checkNpmFeatureCi : checkFeatureCi)({
        slice,
        workflows: readFeatureWorkflows(root, slice),
        ci: process.env.CI === "true",
      }),
    ),
  );
}
